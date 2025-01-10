var config = {
    type: Phaser.AUTO,
    parent: 'phaser-example',
    width: 1920,
    height: 1080,
    scale: {
        mode: Phaser.Scale.FIT,
    },
    dom: {
        createContainer: true
    },
    backgroundColor: '#222222',
    physics: {
        default: 'arcade',
        arcade: {
            debug: true
        }
    },
    scene: { preload, create, update }
}

const Ajv = window.ajv2020
const ajv = new Ajv()

var game = new Phaser.Game(config)

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

// ajv validators for events
const validators = {}

function preload() {
    event_names.forEach(event_name => {
        this.load.json(`schema_${event_name}`, `static/assets/schema_${event_name}.json`)
    })
    this.load.json(`map_data`, `static/assets/map_data.json`)
    for (let i = 0; i < 4; i++) {
        this.load.image(`padoru${i}`, `static/assets/padoru${i}.png`)
    }
    this.load.image("background", "static/assets/background.png")
    this.load.image("steel", "static/assets/steel.png")
    this.load.image("flag", "static/assets/flag.png")
    this.load.audio("music", "static/assets/padoru.mp3")
}

function check_schema(validator, obj) {
    if (!validator(obj)) {
        throw new Error(`Invalid schema: ${JSON.stringify(obj)} due to error ${JSON.stringify(validator.errors)}`)
    }
}

function create() {
    const self = this

    // prepare the animation
    let frames = []
    for (let i = 0; i < 4; i++) {
        frames.push({
            key: `padoru${i}`,
        })
    }
    frames.push({
        key: `padoru0`,
    })
    this.anims.create({
        key: "padoru",
        frames: frames,
        frameRate: 12,
        repeat: 0,
    })

    // background and obstacles
    this.add.image(1920 / 2, 1080 / 2, "background")
    this.static_group = this.physics.add.staticGroup();
    const map_data = this.cache.json.get("map_data");
    for (const obj of map_data) {
        var instance
        if (obj.collides) {
            instance = this.static_group.create(
                obj.x + obj.w / 2,
                obj.y + obj.h / 2,
                obj.key
            )
        } else {
            instance = this.physics.add.sprite(
                obj.x + obj.w / 2,
                obj.y + obj.h / 2,
                obj.key
            )
        }
        instance.setDisplaySize(obj.w, obj.h)
        instance.refreshBody()
    }

    this.nickname_input = this.add.dom(100, 20, 'input', null, "").setScrollFactor(0)
    this.x_input = this.add.dom(100, 50, 'input', null, "").setScrollFactor(0)
    this.y_input = this.add.dom(100, 80, 'input', null, "").setScrollFactor(0)
    this.x_display = self.add.text(200, 50, "0", {
        fontFamily: '"Trade Winds", serif',
        fontWeight: 400,
        backgroundColor: "rgba(0,0,0,0.6)",
        padding: 2,
        fontSize: 17,
        letterSpacing: 1
    }).setScrollFactor(0)
    this.y_display = self.add.text(200, 80, "0", {
        fontFamily: '"Trade Winds", serif',
        fontWeight: 400,
        backgroundColor: "rgba(0,0,0,0.6)",
        padding: 2,
        fontSize: 17,
        letterSpacing: 1
    }).setScrollFactor(0)

    this.x_input.node.addEventListener("keypress", e => {
        if (e.key === 'Enter') {
            this.girl.x = Number(this.x_input.node.value)
        }
    })
    this.y_input.node.addEventListener("keypress", e => {
        if (e.key === 'Enter') {
            this.girl.y = Number(this.y_input.node.value)
        }
    })

    this.physics.world.setBounds(0, 0, 1920, 1080)
    // this.cameras.main.setBounds(0, 0, 1920, 1080)

    // compile validators
    event_names.forEach(event_name => {
        validators[event_name] = ajv.compile(this.cache.json.get(`schema_${event_name}`))
    })


    this.socket = io()

    this.emit_event = (event, obj) => {
        check_schema(validators[event], obj)
        self.socket.emit(event, obj)
    }

    this.otherPlayersGroup = this.physics.add.group()
    this.otherPlayers = {}

    // initialize input
    this.cursors = this.input.keyboard.createCursorKeys()

    // music!!
    let url = new URL(window.location.href);
    self.enable_music = JSON.parse(url.searchParams.get('enable_music')) ?? true
    if (self.enable_music) {
        this.sound.unlock()
        this.sound.play("music", {
            "volume": 0.4,
            "loop": true,
        })
    }
    url.searchParams.set("enable_music", self.enable_music)
    history.replaceState(history.state, '', url.href);

    this.socket.on('new_player', function (data) {
        check_schema(validators["new_player"], data)
        addPlayer(self, data)
    })

    this.socket.on('player_disconnected', function (data) {
        check_schema(validators["player_disconnected"], data)
        if (data.id in self.otherPlayers) {
            self.otherPlayers[data.id].nickname_text.destroy()
            self.otherPlayers[data.id].destroy()
            delete self.otherPlayers[data.id]
        }
    })

    this.socket.on('player_moved', function (data) {
        check_schema(validators["player_moved"], data)
        if (data.id in self.otherPlayers) {
            const player = self.otherPlayers[data.id]
            player.setPosition(data.x, data.y)
            player.setVelocity(data.dx, data.dy)
            if (data.fix_dx) {
                player.fix_dx = data.dx
            } else {
                player.fix_dx = null
            }
        } else {
            throw new Error(`An unknown player with id ${data.id} has moved.`)
        }
    })

    this.socket.on('force_position', function (data) {
        check_schema(validators["force_position"], data)
        self.girl.setPosition(data.x, data.y)
    })

    this.socket.on('player_animation', function (data) {
        check_schema(validators["player_animation"], data)
        if (data.id in self.otherPlayers) {
            player = self.otherPlayers[data.id]
            player.play(data.key)
        } else {
            throw new Error(`An unknown player with id ${data.id} has played an animation.`)
        }
    })

    this.socket.on('alert', function (data) {
        check_schema(validators["alert"], data)
        console.log(data.comment)
    })

    this.socket.on('player_changed_nickname', function (data) {
        check_schema(validators["player_changed_nickname"], data)
        if (data.id in self.otherPlayers) {
            player = self.otherPlayers[data.id]
            player.nickname = data.nickname
            player.nickname_text.setText(data.nickname)
        } else {
            throw new Error(`An unknown player with id ${data.id} has played an animation.`)
        }
    })
}

function addPlayer(self, data) {
    if (data.id in self.otherPlayers) {
        return
    } else if (data.id === self.socket.id) {
        if (!self.initialized_player_once) {
            self.girl = self.physics.add.sprite(data.x, data.y, 'padoru0')
                .setOrigin(0.5, 0.5)
                .setDisplaySize(98, 100)
            self.cursors.left.on("down", () => {
                if (self.cursors.shift.isDown) {
                    self.girl.x -= 100
                }
                self.do_server_update = true
            })
            self.cursors.left.on("up", () => {
                self.do_server_update = true
            })
            self.cursors.right.on("down", () => {
                if (self.cursors.shift.isDown) {
                    self.girl.x += 100
                }
                self.do_server_update = true
            })
            self.cursors.right.on("up", () => {
                self.do_server_update = true
            })
            self.cursors.up.on("down", () => {
                self.girl.play("padoru")
                self.emit_event("me_animation", { key: "padoru" })
                if (self.cursors.shift.isDown) {
                    self.girl.y -= 100
                    self.girl.x += 1e-323
                }
                self.do_server_update = true
            })
            self.cursors.space.on("down", () => {
                self.gravity_disabled = !self.gravity_disabled
            })
            self.physics.add.collider(self.girl, self.static_group);

            self.initialized_player_once = true
        }

        self.color = data.color
        
        let url = new URL(window.location.href);
        self.nickname = url.searchParams.get('nickname')
        if (self.nickname) {
            self.emit_event("me_changed_nickname", {
                nickname: self.nickname
            })
        } else {
            self.nickname = data.nickname
        }
        url.searchParams.set("nickname", self.nickname)
        history.replaceState(history.state, '', url.href);

        self.nickname_input.node.value = self.nickname

        self.girl.setPosition(data.x, data.y)

        self.girl.nickname_text = self.add.text(data.x, data.y - 65, self.nickname, {
            fontFamily: '"Trade Winds", serif',
            fontWeight: 400,
            backgroundColor: "rgba(0,0,0,0.3)",
            padding: 2,
            fontSize: 17,
            letterSpacing: 1
        }).setOrigin(0.5)

        self.girl.setCollideWorldBounds(false)
        self.girl.setTint(data.color)
        self.girl.setDrag(2000)

        self.cameras.main.startFollow(self.girl, false, 0.05, 0.05, 0, 0)
    } else {
        const player = self.physics.add.sprite(data.x, data.y, 'padoru0')
            .setOrigin(0.5, 0.5)
            .setDisplaySize(98, 100)

        self.otherPlayers[data.id] = player
        self.otherPlayersGroup.add(player)

        player.setPosition(data.x, data.y)

        player.nickname = data.nickname
        player.nickname_text = self.add.text(data.x, data.y - 65, data.nickname, {
            fontFamily: '"Trade Winds", serif',
            fontWeight: 400,
            backgroundColor: "rgba(0,0,0,0.3)",
            padding: 2,
            fontSize: 17,
            letterSpacing: 1
        }).setOrigin(0.5)

        player.setTint(data.color)
        player.setDrag(2000)
        player.setCollideWorldBounds(false)

        self.physics.add.collider(player, self.static_group);
    }
}

const side_velocity = 500

function update() {
    if (this.girl) {
        var fix_dx = null;
        if (this.cursors.left.isDown) {
            this.girl.setVelocityX(-side_velocity)
            fix_dx = -side_velocity
        }
        if (this.cursors.right.isDown) {
            this.girl.setVelocityX(side_velocity)
            fix_dx = side_velocity
        }
        if (this.cursors.down.isDown) {
            this.girl.setVelocityY(side_velocity)
            fix_dx = side_velocity
        }
        if (this.cursors.up.isDown) {
            this.girl.setVelocityY(-side_velocity)
            fix_dx = side_velocity
        }

        if (this.gravity_disabled) {
            this.girl.setAccelerationY(0)
        } else {
            this.girl.setAccelerationY(1000)
        }
        this.girl.flipX = this.girl.body.velocity.x < 0 || (this.girl.body.velocity.x == 0 && this.girl.flipX)
        this.girl.nickname_text.setPosition(this.girl.x, this.girl.y - 65)

        Object.values(this.otherPlayers).forEach(player => {
            player.setAccelerationY(1000)
            player.flipX = player.body.velocity.x < 0 || (player.body.velocity.x == 0 && player.flipX)
            if (player.fix_dx !== null) {
                player.setVelocityX(player.fix_dx)
            }
            player.nickname_text.setPosition(player.x, player.y - 65)
        })

        this.x_display.setText(JSON.stringify(this.girl.x))
        this.y_display.setText(JSON.stringify(this.girl.y))

        if (this.do_server_update || (this.time.now - this.last_server_update) > 1000) {
            this.emit_event("me_moved", {
                x: this.girl.x,
                y: this.girl.y,
                dx: this.girl.body.velocity.x,
                dy: this.girl.body.velocity.y,
                fix_dx: fix_dx
            })
            this.do_server_update = false
            this.last_server_update = this.time.now;

            if (this.nickname !== this.nickname_input.node.value) {
                this.nickname = this.nickname_input.node.value
                this.girl.nickname_text.setText(this.nickname)
                this.emit_event("me_changed_nickname", {
                    nickname: this.nickname
                })
            }
        }
    }
}
