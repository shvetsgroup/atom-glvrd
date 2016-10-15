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
			atom.workspace.observeTextEditors(function(editor){
				this.sendGlvrdRequest(editor.getText());
			}.bind(this));
		}
		return (
			this.modalPanel.isVisible() ?
				this.modalPanel.hide() :
				this.modalPanel.show()
		);
	},

	sendGlvrdRequest(text) {
		glvrd.getStatus(function (result) {
			if (result.status != 'ok') {
				//this.notifications.addError("Извините, Главред недоступен. Повторите запрос через минуту.");
			}
			glvrd.proofread(text, this.processGlvrdResponse)
		})
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

	},
};
