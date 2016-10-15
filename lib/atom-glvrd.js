'use babel';

import AtomGlvrdView from './atom-glvrd-view';
import { CompositeDisposable } from 'atom';

export default {

  atomGlvrdView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {
    this.atomGlvrdView = new AtomGlvrdView(state.atomGlvrdViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.atomGlvrdView.getElement(),
      visible: false
    });

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
    return (
      this.modalPanel.isVisible() ?
      this.modalPanel.hide() :
      this.modalPanel.show()
    );
  }

};
