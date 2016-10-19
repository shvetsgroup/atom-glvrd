'use babel';

import AtomGlvrdView from "./atom-glvrd-view";
import {CompositeDisposable} from "atom";
import {glvrd} from "./api/glvrd.js";


export default {

    glvrdView: null,
    glvrdPanel: null,
    glvrdApi: {},
    glvrdCache: {},
    glvrdCredentials: {
        key: null,
        token: null,
        created: 0,
    },
    subscriptions: null,

    activate() {
        this.subscriptions = new CompositeDisposable();
        this.subscriptions.add(atom.commands.add('atom-workspace', {
            'atom-glvrd:toggle': () => {
                this.check()
            },
            'atom-glvrd:close': () => {
                this.close()
            }
        }));

        this.glvrdView = new AtomGlvrdView();
        this.glvrdPanel = atom.workspace.addRightPanel({
            item: this.glvrdView,
            visible: false
        });

        this.subscriptions.add(atom.workspace.observeTextEditors((editor) => {
            atom.workspace.onDidChangeActivePaneItem(() => {
                this.glvrdPanel.hide();
                this.updatePanel(atom.workspace.getActiveTextEditor());
            });
        }));
    },

    deactivate() {
        this.glvrdPanel.destroy();
        this.glvrdView.destroy();
        this.subscriptions.dispose();
    },

    check() {
        var editor = atom.workspace.getActiveTextEditor();
        if (!editor) {
            return;
        }

        this.checkText(editor).then(function () {
            if (this.glvrdCache[editor.id].bound) {
                return;
            }

            let cursorDisposable = editor.onDidChangeCursorPosition((event) => {
                var layer = editor.displayLayer.glavred;
                if (!layer) {
                    return;
                }

                var markers = layer.findMarkers({valid: true, containsPoint: event.newBufferPosition});
                if (markers.length) {
                    this.glvrdView.setHint(markers[0].hint);
                }
                else {
                    this.glvrdView.resetHints();
                }
            });

            let changeDisposable = editor.onDidStopChanging((event) => {
                this.checkText(editor, "paragraph");
            });

            editor.onDidDestroy(() => {
                cursorDisposable.dispose();
                changeDisposable.dispose();
            });

            this.glvrdCache[editor.id].bound = true;
        }.bind(this));
    },

    close() {
        var editor = atom.workspace.getActiveTextEditor();
        if (!editor || !this.glvrdCache[editor.id]) {
            return;
        }

        delete this.glvrdCache[editor.id];

        var layer = editor.displayLayer.glavred;
        layer.getMarkers().forEach(function (marker) {
            marker.destroy();
        });
        layer.destroy();
        delete editor.displayLayer.glavred;

        this.glvrdPanel.hide();
    },

    checkText(editor, mode) {
        return this.checkKeys().then((credentials) => {
            var text;
            if (mode == "paragraph") {
                var range = editor.getCurrentParagraphBufferRange();
                text = editor.getTextInBufferRange(range)
            }
            else {
                text = editor.getText();
            }
            return this.doGlvrdRequest(editor, text, credentials.key, credentials.token);
        }).then((result) => {
            return this.processGlvrdResponse(editor, result);
        }).then((result) => {
            if (mode == "paragraph") {
                this.updateMarkers(editor, result.fragments, editor.getCurrentParagraphBufferRange());
                this.updatePanel(editor, this.recalculateScore(editor));
            }
            else {
                this.updateMarkers(editor, result.fragments);
                this.updatePanel(editor, result.score);
            }
        });
    },

    checkKeys() {
        var that = this;
        return new Promise((resolve, reject) => {
            var timestamp = (new Date()).getTime();
            if ((that.glvrdCredentials.created + 60000) < timestamp) {
                fetch('https://dev.githowto.com/glavred.php')
                    .then((response) => {
                        if (!response.ok) {
                            throw Error(response.statusText);
                        }
                        return response;
                    })
                    .then((response) => {
                        response.json().then((data) => {
                            that.glvrdCredentials.key = data.key;
                            that.glvrdCredentials.token = data.token;
                            that.glvrdCredentials.created = timestamp;
                            resolve(that.glvrdCredentials)
                        });
                    })
                    .catch((error) => {
                        atom.notifications.addError("Не могу получить ключи АПИ главреда.");
                        reject()
                    });
            }
            else {
                resolve(that.glvrdCredentials)
            }
        });
    },

    getGlavredApi(key, token) {
        key = key || this.glvrdCredentials.key;
        token = token || this.glvrdCredentials.token;
        var cacheKey = (key && token) ? key + token : "default";
        if (!this.glvrdApi[cacheKey]) {
            this.glvrdApi[cacheKey] = glvrd(key, token);
        }
        return this.glvrdApi[cacheKey];
    },

    doGlvrdRequest(editor, text, key, token) {
        var that = this;
        return new Promise((resolve, reject) => {
            var glavred = that.getGlavredApi(key, token);
            glavred.getStatus((result) => {
                if (result.status != 'ok') {
                    reject();
                    return atom.notifications.addError("Извините, Главред недоступен. Повторите запрос через минуту.");
                }
                glavred.proofread(text, (result) => {
                    resolve(result);
                });
            });
        });
    },

    processGlvrdResponse(editor, result) {
        var that = this;
        return new Promise((resolve, reject) => {
            if (result.status != 'ok') {
                reject();
                return atom.notifications.addError("Главред вернул статус ошибки при проверке текста.");
            }
            that.glvrdCache[editor.id] = {score: result.score};
            resolve(result);
        });
    },

    updateMarkers(editor, fragments, range) {
        var layer = this.getMarkersLayer(editor);
        layer.getMarkers().forEach(function (marker) {
            if (range == undefined || marker.isValid && range.containsRange(marker.getBufferRange())) {
                marker.destroy();
            }
        });
        this.createMarkersFromFragments(editor, layer, fragments, range);
    },

    getMarkersLayer(editor) {
        var displayLayer = editor.displayLayer;
        var layer = displayLayer.glavred;
        if (!layer) {
            layer = displayLayer.addMarkerLayer({
                maintainHistory: true,
                persistent: true
            });
            displayLayer.glavred = layer;
            editor.decorateMarkerLayer(layer, {
                type: "highlight",
                class: "glvrd-underline"
            });
        }
        return layer;
    },

    createMarkersFromFragments(editor, layer, fragments, range) {
        for (var i = 0; i < fragments.length; i++) {
            var start, end;
            if (range) {
                start = range.traverse([0, fragments[i].start]).start;
                end = range.traverse([0, fragments[i].end]).start;
            }
            else {
                start = editor.displayLayer.buffer.positionForCharacterIndex(fragments[i].start);
                end = editor.displayLayer.buffer.positionForCharacterIndex(fragments[i].end);
            }
            var marker = layer.markBufferRange([start, end], {
                maintainHistory: "true",
                invalidate: "touch"
            });
            marker.hint = fragments[i].hint;
        }
    },

    recalculateScore(editor) {
        var layer = this.getMarkersLayer(editor);
        var texts = [];
        var buffer = editor.getBuffer();
        var row = -1;
        do {
            row = buffer.nextNonBlankRow(row);
            if (row === null) {
                break;
            }

            var text = {
                text: buffer.lineForRow(row),
                fragments: []
            };

            var markers = layer.findMarkers({valid: true, startRow: row});
            if (markers.length) {
                markers.forEach((marker) => {
                    text.fragments.push({hint: marker.hint});
                });
            }
            texts.push(text);
        } while (row !== null);

        return this.getGlavredApi().getScore(texts);
    },

    updatePanel(editor, score) {
        if (!editor) {
            return;
        }

        if (!score && this.glvrdCache[editor.id]) {
            score = this.glvrdCache[editor.id].score;
        }
        if (score == undefined) {
            return;
        }

        this.glvrdView.setScore(score);
        this.glvrdView.resetHints();
        this.glvrdPanel.show();
    }
};
