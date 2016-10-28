'use babel';

export var glvrd = function (e, t) {
    function n(e) {
        return {status: "error", code: e, message: c[e]}
    }

    function r(e) {
        var t = "";
        for (var n in e)if (e.hasOwnProperty(n)) {
            var r;
            for (r = e[n] instanceof Array ? e[n] : [e[n]], i = 0; i < r.length; i++)t.length > 0 && (t += "&"), t += encodeURIComponent(n) + "=" + encodeURIComponent(r[i])
        }
        return t
    }

    function o(e, t, n, o, a) {
        var s = new XMLHttpRequest;
        return s.open("POST", encodeURI(e)), s.setRequestHeader("Content-Type", "application/x-www-form-urlencoded"), s.onload = function () {
            var e = s.responseText;
            try {
                e = JSON.parse(e)
            } catch (t) {
            }
            200 == s.status ? n && n(e) : o && o(e), a && a(e)
        }, s.send(r(t)), s
    }

    function a(e) {
        for (var t, n = 1e4, r = [], o = /[\.?!](\s*\r|\s*\n|\s*(<\/em>)|\s*(?=<)|\s+(?=[A-ZА-Я]))/g, a = 0; null !== (t = o.exec(e)) && (end = o.lastIndex, !(end > n));)r.push({
            text: e.slice(a, end),
            start: a,
            end: end
        }), a = end;
        return e.length < n && r.push({text: e.slice(a), start: a, end: e.length}), r
    }

    function s(e) {
        for (var t = {status: "ok", score: 0, fragments: []}, n = [], r = 0; r < e.length; r++) {
            for (var o = e[r], a = g[o.text], s = [], u = 0; u < a.length; u++) {
                var i = a[u], f = {
                    start: o.start + i.start,
                    end: o.start + i.end,
                    url: "https://glvrd.ru/?text=" + encodeURIComponent(o.text),
                    hint: p[i.hint]
                };
                t.fragments.push(f), s.push(f)
            }
            n.push({text: o.text, fragments: s})
        }
        return t.score = v.getScore(n), t
    }

    var u = "https://api.glvrd.ru/v1/", f = {
        status: u + "status/",
        proofread: u + "proofread/"
    }, c = {
        unreadable_response: "Пришел непонятный ответ от сервера",
        failed_request: "Запрос неудачен"
    }, l = null, d = !1, h = /[А-Яа-яA-Za-z0-9-]+([^А-Яа-яA-Za-z0-9-]+)?/g, g = {}, p = {}, v = {
        getStatus: function (r) {
            o(f.status, {key: e, token: t}, function (e) {
                r(void 0 === e.status ? n("unreadable_response") : e)
            }, function () {
                r(n("failed_request"))
            })
        }, abortProofreading: function () {
            l && (d = !0, l.abort(), l = null)
        }, proofread: function (r, u) {
            for (var i = {}, c = a(r), h = [], v = [], m = 0; m < c.length; m++) {
                var x = c[m], r = x.text;
                g[r] ? i[r] = g[r] : (h.push(x), v.push(r))
            }
            if (0 == h.length) {
                var y = s(c);
                return void u(y)
            }
            l = o(f.proofread, {key: e, token: t, chunks: v}, function (e) {
                if (void 0 === e.status)return void u(n("unreadable_response"));
                if (e.fragments.length != h.length)return void u(n("unreadable_response"));
                for (var t in e.hints)p[t] = e.hints[t];
                for (var r = 0; r < e.fragments.length; r++)i[h[r].text] = e.fragments[r];
                g = i, u(s(c))
            }, function () {
                d ? d = !1 : u(n("failed_request"))
            }, function () {
                l = null
            })
        }, getScore: function (e) {
            for (var t = 0, n = 0, r = 0, o = 0; o < e.length; o++) {
                var a = e[o].text.trim();
                t += a ? a.replace(h, ".").length : 0;
                var s = e[o].fragments;
                r += s.length;
                for (var u = 0; u < s.length; u++) {
                    var i = s[u];
                    i.hint.penalty && (n += i.hint.penalty)
                }
            }
            return 0 == t ? 0 : (score = Math.floor(100 * Math.pow(1 - r / t, 3)) - n, score = Math.min(Math.max(score, 0), 100), score % 10 == 0 ? score /= 10 : score = (score / 10).toFixed(1), score)
        }
    };
    return v
};
