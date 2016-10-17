'use babel';

import AtomGlvrdView from "./atom-glvrd-view";
import {CompositeDisposable} from "atom";
//import {NotificationManager} from "atom";
import {glvrd} from "./api/glvrd.js";

export default {

    atomGlvrdView: null,
    modalPanel: null,
    subscriptions: null,
    notifications: null,
    fragments: null,
    glvrd_keys: {
        key: null,
        token: null,
        created: 0,
    },

    activate(state) {
        this.atomGlvrdView = new AtomGlvrdView(state.atomGlvrdViewState);
        this.modalPanel = atom.workspace.addRightPanel({
            item: this.atomGlvrdView.getElement(),
            visible: false
        });

        //this.notifications = NotificationManager;

        // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
        this.subscriptions = new CompositeDisposable();

        // Register command that toggles this view
        this.subscriptions.add(atom.commands.add('atom-workspace', {
            'atom-glvrd:toggle': () => this.toggle()
        }));
    },

    deactivate() {
        this.modalPanel.destroy();
        this.subscriptions.dispose();
        this.atomGlvrdView.destroy();
    },

    serialize() {
        return {
            atomGlvrdViewState: this.atomGlvrdView.serialize()
        };
    },

    toggle() {
        console.log('AtomGlvrd was toggled!');
        if (!this.modalPanel.isVisible()) {
            atom.workspace.observeTextEditors((editor) => {
                this.checkText(editor.getText());
            });
        }
        return (
            this.modalPanel.isVisible() ?
                this.modalPanel.hide() :
                this.modalPanel.show()
        );
    },

    checkText(text) {
        var timestamp = (new Date()).getTime();
        if (this.glvrd_keys.created + 60 < timestamp) {
            fetch('https://dev.githowto.com/glavred.php').then((response) => {
                response.json().then((data) => {
                    this.glvrd_keys.key = data.key;
                    this.glvrd_keys.token = data.token;
                    this.doGlvrdRequest(text, this.glvrd_keys.key, this.glvrd_keys.token);
                });
            });
        }
        else {
            this.doGlvrdRequest(text, this.glvrd_keys.key, this.glvrd_keys.token);
        }
    },

    doGlvrdRequest(text, key, token) {
        var glavred = glvrd(key, token);
        glavred.getStatus((result) => {
            if (result.status != 'ok') {
                //this.notifications.addError("Извините, Главред недоступен. Повторите запрос через минуту.");
            }
            glavred.proofread(text,this.processGlvrdResponse.bind(this))
        });
    },

    processGlvrdResponse(result) {
        if (result.status != 'ok') {
            //this.notifications.addError("Главред вернул статус ошибки при проверке текста.");
        }
        this.atomGlvrdView.setScore(result.score);
        this.atomGlvrdView.resetHints();
        this.fragments = result.fragments;
        this.updateMarkers();
    },

    updateMarkers() {

    }
};
