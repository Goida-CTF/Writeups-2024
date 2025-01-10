const express = require('express')
const http = require('http')
const path = require('path')
const socketIO = require('socket.io')
const Ajv = require('ajv/dist/2020')
const NameGen = require('unique-names-generator')

const ajv = new Ajv()
const app = express()
var server = http.Server(app)
var io = socketIO(server, {
    pingTimeout: 60000,
})

const event_names = [
    "me_animation",
    "me_moved",
    "new_player",
    "player_animation",
    "player_disconnected",
    "player_moved",
    "alert",
    "force_position",
    "me_changed_nickname",
    "player_changed_nickname"
]

const validators = {}

event_names.forEach(event_name => {
    validators[event_name] = ajv.compile(require(`./static/assets/schema_${event_name}.json`))
})

const port = 31337

app.set('port', port)
app.use('/static', express.static(__dirname + '/static'))

app.get('/', function (request, response) {
    response.sendFile(path.join(__dirname, 'index.html'))
})

server.listen(port, function() {
    console.log('Listening on port: ' + port + '.')
})

var players = {}

const flags = [
    process.env.FLAG1 || "goidactf{REDACTED1REDACTED1REDACTED1REDACTED1REDACTED1}",
    process.env.FLAG2 || "goidactf{REDACTED2REDACTED2REDACTED2REDACTED2REDACTED2}"
]

function check_schema(validator, obj) {
    if (!validator(obj)) {
        throw new Error(`Invalid schema: ${JSON.stringify(obj)} due to error ${JSON.stringify(validator.errors)}`)
    }
}

var map_data = require(`./static/assets/map_data.json`)

function check_line_collision(x1, y1, x2, y2, x3, y3, x4, y4) {
    if (x1 > x2) {
        [x1, y1, x2, y2] = [x2, y2, x1, y1];
    }
    if (x3 > x4) {
        [x3, y3, x4, y4] = [x4, y4, x3, y3];
    }
    const k1 = (y2 - y1) / (x2 - x1)
    const b1 = y1 - k1 * x1
    const k2 = (y4 - y3) / (x4 - x3)
    const b2 = y3 - k2 * x3

    // (a <= b && b <= c) || (c <= b && b <= a)    <=>    b lies between a and c
    if (x1 === x2 && x3 === x4) {
        return x1 === x3 && ((y1 <= y3 && y3 <= y2) || (y2 <= y3 && y3 <= y1) || (y1 <= y4 && y4 <= y2) || (y2 <= y4 && y4 <= y1))
    } else if (x1 === x2) {
        const y = k2 * x1 + b2
        return x3 <= x1 && x1 <= x4 && ((y1 <= y && y <= y2) || (y2 <= y && y <= y1))
    } else if (x3 === x4) {
        const y = k1 * x3 + b1
        return x1 <= x3 && x3 <= x2 && ((y3 < y && y < y4) || (y4 < y && y < y3))
    } else {
        const x = (b2 - b1) / (k1 - k2)
        const y = k2 * x + b2
        return x1 <= x && x <= x2 && x3 <= x && x <= x4 && ((y1 <= y && y <= y2) || (y2 <= y && y <= y1)) && ((y3 <= y && y <= y4) || (y4 <= y && y <= y3))
    }
}

function check_box_line_collision(x1, y1, x2, y2, x, y, h, w) {
    return check_line_collision(x1, y1, x2, y2, x, y, x + w, y)
        || check_line_collision(x1, y1, x2, y2, x, y, x, y + h)
        || check_line_collision(x1, y1, x2, y2, x + w, y, x + w, y + h)
        || check_line_collision(x1, y1, x2, y2, x, y + h, x + w, y + h)
}

io.on('connection', function (socket) {
    console.log('player [' + socket.id + '] connected')

    function emit_event(event, obj) {
        check_schema(validators[event], obj)
        socket.emit(event, obj)
    }

    function broadcast_event(event, obj) {
        check_schema(validators[event], obj)
        socket.broadcast.emit(event, obj)
    }

    function add_callback_with_error_handling(event, callback) {
        socket.on(event, function (data) {
            try {
                check_schema(validators[event], data);
                callback(data);
            } catch (e) {
                console.log(e);
            }
        })
    }


    const playerInfo = {
        color: getRandomColor(),
        x: 100,
        y: 100,
        nickname: NameGen.uniqueNamesGenerator({dictionaries: [NameGen.adjectives, NameGen.animals, NameGen.names]})
    }

    // send everyone the newly instantiated player
    broadcast_event("new_player", {
        id: socket.id,
        ...playerInfo
    })

    players[socket.id] = playerInfo

    // tell the new player about all the others
    Object.keys(players).forEach(id => {
        emit_event("new_player", {
            id: id,
            ...players[id]
        })
    })

    socket.on('disconnect', function () {
        console.log('player [' + socket.id + '] disconnected')
        delete players[socket.id]

        broadcast_event("player_disconnected", { id: socket.id })
    })

    add_callback_with_error_handling("me_moved", function (data) {
        const x1 = players[socket.id].x
        const y1 = players[socket.id].y

        console.log(`${players[socket.id].nickname}: (${x1}, ${y1}) -> (${data.x}, ${data.y})`)

        for (const obj of map_data) {
            if (obj.collides && check_box_line_collision(x1, y1, data.x, data.y, obj.x, obj.y, obj.h, obj.w)) {
                emit_event("alert", {
                    comment: "No cheating!"
                })
                emit_event("force_position", {
                    x: x1,
                    y: y1
                })
                return
            }
        }
        for (const obj of map_data) {
            if (obj.key === "flag" && check_box_line_collision(x1, y1, data.x, data.y, obj.x, obj.y, obj.h, obj.w)) {
                emit_event("alert", {
                    comment: `Congratulations! You win! FLAG: ${flags[obj.flag_id]} There are 2 flags here though.`,
                })
            }
        }

        players[socket.id].x = data.x
        players[socket.id].y = data.y

        broadcast_event('player_moved', {
            id: socket.id,
            ...data
        })
    })

    add_callback_with_error_handling("me_animation", function (data) {
        broadcast_event('player_animation', {
            id: socket.id,
            ...data
        })
    })

    add_callback_with_error_handling("me_changed_nickname", function (data) {
        players[socket.id].nickname = data.nickname

        broadcast_event('player_changed_nickname', {
            id: socket.id,
            ...data
        })
    })
})

function HSVtoRGB(h, s, v) {
    var r, g, b, i, f, p, q, t;
    if (arguments.length === 1) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return [
        Math.round(r * 255),
        Math.round(g * 255),
        Math.round(b * 255)
    ];
}

function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
    return "0x" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function getRandomColor() {
    var hue = Math.random();
    return rgbToHex(...HSVtoRGB(hue, 0.3, 1));
}