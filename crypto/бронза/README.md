# Бронза
**Категория:** Чеченские головоломки (crypto)\
**Автор:** [maximxls](https://t.me/maximxlss)\
**Количество решений:** 3

Выглядит очень знакомо, не правда ли? Мой гитхаб: https://github.com/maximxlss ;)

### Решение
Находим [райтап](https://maximxlss.github.io/writeups/crypter/writeup), читаем. Находим [реализацию](https://github.com/ubuntor/coppersmith-algorithm/) метода Копперсмита для двух переменных, устанавливаем, адаптируем райтап, запускаем:
```Python
import itertools
from sage.all import *
from Crypto.Util.number import long_to_bytes


# взято с https://github.com/ubuntor/coppersmith-algorithm/blob/main/coppersmith.sage
# (модифицировано под обычный пайтон)
def coron(pol, X, Y, k=2, debug=False):
    if pol.nvariables() != 2:
        raise ValueError("pol is not bivariate")

    P = PolynomialRing(ZZ, "x, y")
    x, y = P.gens()
    pol = pol(x, y)

    # Handle case where pol(0,0) == 0
    xoffset = 0

    while pol(xoffset, 0) == 0:
        xoffset += 1

    pol = pol(x + xoffset, y)

    # Handle case where gcd(pol(0,0),X*Y) != 1
    while gcd(pol(0, 0), X) != 1:
        X = next_prime(X, proof=False)

    while gcd(pol(0, 0), Y) != 1:
        Y = next_prime(Y, proof=False)

    pol = P(pol / gcd(pol.coefficients()))  # seems to be helpful
    p00 = pol(0, 0)
    delta = max(pol.degree(x), pol.degree(y))  # maximum degree of any variable

    W = max(abs(i) for i in pol(x * X, y * Y).coefficients())
    u = W + ((1 - W) % abs(p00))
    N = u * (X * Y) ** k  # modulus for polynomials

    # Construct polynomials
    p00inv = inverse_mod(p00, N)
    polq = P(
        sum((i * p00inv % N) * j for i, j in zip(pol.coefficients(), pol.monomials()))
    )
    polynomials = []
    for i in range(delta + k + 1):
        for j in range(delta + k + 1):
            if 0 <= i <= k and 0 <= j <= k:
                polynomials.append(polq * x**i * y**j * X ** (k - i) * Y ** (k - j))
            else:
                polynomials.append(x**i * y**j * N)

    # Make list of monomials for matrix indices
    monomials = []
    for i in polynomials:
        for j in i.monomials():
            if j not in monomials:
                monomials.append(j)
    monomials.sort()

    # Construct lattice spanned by polynomials with xX and yY
    L = matrix(ZZ, len(monomials))
    for i in range(len(monomials)):
        for j in range(len(monomials)):
            L[i, j] = polynomials[i](X * x, Y * y).monomial_coefficient(monomials[j])

    # makes lattice upper triangular
    # probably not needed, but it makes debug output pretty
    L = matrix(ZZ, sorted(L, reverse=True))

    if debug:
        print("Bitlengths of matrix elements (before reduction):")
        print(L.apply_map(lambda x: x.nbits()).str())

    L = L.LLL()

    if debug:
        print("Bitlengths of matrix elements (after reduction):")
        print(L.apply_map(lambda x: x.nbits()).str())

    roots = []

    for i in range(L.nrows()):
        if debug:
            print("Trying row {}".format(i))

        # i'th row converted to polynomial dividing out X and Y
        pol2 = P(sum(map(mul, zip(L[i], monomials)))(x / X, y / Y))

        r = pol.resultant(pol2, y)

        if r.is_constant():  # not independent
            continue

        for x0, _ in r.univariate_polynomial().roots():
            if x0 - xoffset in [i[0] for i in roots]:
                continue
            if debug:
                print("Potential x0:", x0)
            for y0, _ in pol(x0, y).univariate_polynomial().roots():
                if debug:
                    print("Potential y0:", y0)
                if (x0 - xoffset, y0) not in roots and pol(x0, y0) == 0:
                    roots.append((x0 - xoffset, y0))
    return roots


n = 84818281391416988997372287724655680965837666548724420644546487746697643167900622705530982561602209595274350587046486155117075663375577797152945543425242386362355993402978169362614813715633458849727088395165374290624372116470761213572470091330571473923240309579761758956559159880186678416217096093140607771117
N = 193158996712559280164260023316732110706389108733262505624644811554178382672459977840362985288641632804314404102861640558737590352479931565156197670540030507585505345948266783285928056239905956258965494844433317280395503027628931646564549392539755022453353716799040883921614118215736470837331343452574962937874872987164121503727301049835269684496031717361201878833837401929818621826845922185496856684846168205761858638076185118959522811247074791137477336072604942163654533449989665596705334353740674421366925676532321724288850662329510190797477002937841731091883128296215537310377734161491514473191296557423299518149556975669355790976489135699923078860115041566724423254063708721734853983890875362033479658133818803107414903652872882777766317703842042102089044966372015893373279048660823365698076425294583659806667561664759042621290611855518560850583167860780207824946942122101979563547585520490868056083679293089845272550771266428234434373418853006483672235861011
e = 65537
ct = 43546324583846832704792410544277809683558194986591350286184595012646407794320436830393247465880794247374402845713757841679001178991590607018686817003727087930038024460683873703943929250683117815529359298933134549982632160672001659634227363600311681517944136641339218370626084273364010867765008845804395219378489589505267243509650309735061817747230119217510727206756416707714738058660642269277294404628643969803400801562834848039142513527918638836796260171839559120452620958159003284191670331793346077909594628393989965609999133570175990295504119885408189387236498844312759190860207320217401320581769416580007588481281649209293812187243179180016127531395093505185164453862391440197613018773312393852808121389037755684891873475375540760960744854035438999997407490191724203008843466032504535020868674382094448671279313162489830792808848180518137921084120390209916821620933759177443299695577976062188133352940242645262646767713079923862546360293076146623829219139887

PR = PolynomialRing(ZZ, "a, b")
a, b = PR.gens()

bn_part = N % n

p = a * n + 1
q = n * b + bn_part
poly = p * q - N

roots = coron(poly, 2**128, 2**1024, 2)
a, b = roots[0]
p = a * n + 1
q = n * b + bn_part
assert p * q == N
phi = (p - 1) * (q - 1)
d = mod(e, phi) ** -1
m = mod(ct, N) ** d

print(long_to_bytes(int(m)))
```

