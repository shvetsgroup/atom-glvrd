'use babel';

import AtomGlvrdView from "./atom-glvrd-view";
import {CompositeDisposable} from "atom";
import {Range} from "atom";
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
            if (this.glvrdCache[editor.id] && this.glvrdCache[editor.id].bound) {
                return;
            }

            let cursorDisposable = editor.onDidChangeCursorPosition((event) => {
                this.clickAt(editor, event.newBufferPosition);
            });

            let changeDisposable = editor.onDidStopChanging((event) => {
                this.checkText(editor);
            });

            editor.onDidDestroy(() => {
                cursorDisposable.dispose();
                changeDisposable.dispose();
            });

            this.glvrdCache[editor.id] = this.glvrdCache[editor.id] || {};
            this.glvrdCache[editor.id].bound = true;
        }.bind(this));
    },

    close() {
        var editor = atom.workspace.getActiveTextEditor();
        if (!editor || !this.glvrdCache[editor.id]) {
            return;
        }

        delete this.glvrdCache[editor.id];

        var layers = editor.displayLayer.glavred;
        layers.errors.getMarkers().forEach((marker) => marker.destroy());
        layers.validation.getMarkers().forEach((marker) => marker.destroy());
        layers.errors.destroy();
        layers.validation.destroy();
        delete editor.displayLayer.glavred;

        this.glvrdPanel.hide();
    },

    clickAt(editor, point) {
        var layers = editor.displayLayer.glavred;
        if (!layers) {
            return;
        }
        var markers = layers.errors.findMarkers({valid: true, containsPoint: point});
        if (markers.length) {
            var fragment = markers[0].getProperties().fragment;
            this.glvrdView.setHint(fragment.hint, fragment.url);
        }
        else {
            this.glvrdView.resetHints();
        }
    },

    checkText(editor) {
        var that = this;
        return new Promise((resolve, reject) => {
            var regions = that.getNonValidatedRegions(editor);
            if (!regions.length) {
                that.updateScore(editor);
                that.updateStats(editor);
                that.updatePanel(editor);
                return resolve();
            }

            that.glvrdView.progress();
            that.glvrdPanel.show();

            that.checkKeys().then((credentials) => {
                var promises = [];
                for (var i = 0; i < regions.length; i++) {
                    var promise = that.doGlvrdRequest(editor, regions[i], credentials.key, credentials.token);
                    promises.push(promise);
                }
                return Promise.all(promises);
            }).then(() => {
                that.updateMarkers(editor, regions);
                that.updateScore(editor);
                that.updateStats(editor);
                that.updatePanel(editor);
                resolve();
            }).catch((error) => {
                that.glvrdPanel.hide();
                atom.notifications.addError(error);
            });
        });
    },

    getNonValidatedRegions(editor) {
        var layers = this.getMarkersLayers(editor);
        var regions = [];
        var buffer = editor.getBuffer();

        var start, end, started = false;
        var row = 0, line;
        while (row < buffer.getLineCount()) {
            if (buffer.isRowBlank(row)) {
                row++;
                continue;
            }

            var markers = [];
            layers.validation.findMarkers({valid: true, startRow: row}).forEach((marker) => {
                // Invalidate marker lines which have fresh text around it.
                var range = marker.getBufferRange();
                if (range.start.column > 0 || range.end.column < buffer.lineLengthForRow(row)) {
                    return marker.destroy();
                }
                markers.push(marker);
            });

            if (!started && !markers.length) {
                started = true;
                start = [row, 0];
            }

            if (started && markers.length) {
                end = [row - 1, buffer.lineLengthForRow(row - 1)];
            }
            else if (started && row == (buffer.getLineCount() - 1)) {
                end = [row, buffer.lineLengthForRow(row)];
            }

            if (started && end) {
                regions.push({
                    text: buffer.getTextInRange([start, end]),
                    range: new Range(start, end)
                });
                started = false;
                start = null;
                end = null;
            }
            row++;
        }

        return regions;
    },

    checkKeys() {
        var that = this;
        return new Promise((resolve, reject) => {
            var timestamp = (new Date()).getTime();
            if ((that.glvrdCredentials.created + 60000) < timestamp) {
                fetch('https://githowto.com/glavred.php')
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
                        reject("Не могу получить ключи АПИ главреда.")
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

    doGlvrdRequest(editor, region, key, token) {
        var that = this;
        return new Promise((resolve, reject) => {
            var glavred = that.getGlavredApi(key, token);
            glavred.getStatus((result) => {
                if (result.status != 'ok') {
                    return reject("Извините, Главред недоступен. Повторите запрос через минуту.");
                }
                glavred.proofread(region.text, (result) => {
                    if (result.status != 'ok') {
                        return reject("Главред вернул статус ошибки при проверке текста.");
                    }
                    region.fragments = result.fragments;
                    resolve(region);
                });
            });
        });
    },

    updateMarkers(editor, regions) {
        var layers = this.getMarkersLayers(editor);
        var markers = [];
        markers = markers.concat(layers.errors.getMarkers());
        markers = markers.concat(layers.validation.getMarkers());
        for (var i = 0; i < regions.length; i++) {
            var region = regions[i];
            for (var j = 0; j < markers.length; j++) {
                if (region.range.containsRange(markers[j].getBufferRange())) {
                    markers[j].destroy();
                }
            }
            this.createErrorMarkers(editor, layers.errors, region);
            this.createValidationMarkers(editor, layers.validation, region);
        }
    },

    getMarkersLayers(editor) {
        var displayLayer = editor.displayLayer;
        var layers = displayLayer.glavred;
        if (!layers) {
            layers = {validation: null, errors: null};
            layers.validation = displayLayer.addMarkerLayer({maintainHistory: true, persistent: true});
            layers.errors = displayLayer.addMarkerLayer({maintainHistory: true, persistent: true});
            editor.decorateMarkerLayer(layers.errors, {type: "highlight", class: "glvrd-error"});
            editor.decorateMarkerLayer(layers.validation, {type: "highlight", class: "glvrd-validation"});
            displayLayer.glavred = layers;
        }
        return layers;
    },

    createErrorMarkers(editor, layer, region) {
        var buffer = editor.getBuffer();
        var startOffset = buffer.characterIndexForPosition(region.range.start);
        for (var i = 0; i < region.fragments.length; i++) {
            var start = buffer.positionForCharacterIndex(startOffset + region.fragments[i].start);
            var end = buffer.positionForCharacterIndex(startOffset + region.fragments[i].end);
            var marker = layer.markBufferRange([start, end], {
                maintainHistory: "true",
                invalidate: "inside"
            });
            marker.setProperties({fragment: region.fragments[i]});
        }
    },

    createValidationMarkers(editor, layer, region) {
        var buffer = editor.getBuffer();
        var row = region.range.start.row;
        do {
            if (buffer.isRowBlank(row)) {
                row++;
                continue;
            }

            layer.markBufferRange(buffer.rangeForRow(row), {
                maintainHistory: "true",
                invalidate: "inside"
            });
            row++;
        } while (row <= region.range.end.row);
    },

    updateScore(editor) {
        var buffer = editor.getBuffer();
        var layers = editor.displayLayer.glavred;
        if (!layers) {
            return;
        }

        var regions = [];
        layers.validation.findMarkers({valid: true}).forEach(function (marker) {
            var lineRange = marker.getBufferRange();
            var region = {text: buffer.getTextInRange(lineRange), fragments: []};
            layers.errors.findMarkers({valid: true, startRow: lineRange.start.row}).forEach(function (marker) {
                var fragment = marker.getProperties().fragment;
                fragment.start = marker.getBufferRange().start.column;
                fragment.end = marker.getBufferRange().end.column;
                region.fragments.push(fragment)
            });
            regions.push(region);
        });

        var score = parseFloat(this.getGlavredApi().getScore(regions));
        this.glvrdCache[editor.id] = this.glvrdCache[editor.id] || {};
        this.glvrdCache[editor.id].score = score;
        return score;
    },

    updateStats(editor)
    {
        var text = editor.getBuffer().getText().trim();
        this.glvrdCache[editor.id] = this.glvrdCache[editor.id] || {};


        var global_sentences = text.match(/[^\s](\.|…|\!|\?)(?!\w)(?!\.\.)/g);
        var global_words = text.replace(/[А-Яа-яA-Za-z0-9-]+([^А-Яа-яA-Za-z0-9-]+)?/g, ".");
        var global_chars = text.replace(/[^А-Яа-яA-Za-z0-9-\s.,()-]+/g, "");
        global_sentences = (global_sentences) ? global_sentences.length : 0;
        global_words = (global_words) ? global_words.length : 0;
        global_chars = (global_chars) ? global_chars.length : 0;
        if (text && !/(\.|…|\!|\?)/g.test(text.slice(-1))) {
            global_sentences++;
        }

        this.glvrdCache[editor.id].sentences = global_sentences;
        this.glvrdCache[editor.id].words = global_words;
        this.glvrdCache[editor.id].chars = global_chars;
    },

    updatePanel(editor)
    {
        if (!editor || this.glvrdCache[editor.id] == undefined) {
            return;
        }

        if (this.glvrdCache[editor.id]) {
            this.glvrdView.setTextStats(this.glvrdCache[editor.id]);
            this.clickAt(editor, editor.getCursorBufferPosition());
            this.glvrdView.full();
            this.glvrdPanel.show();
        }
    }
}
