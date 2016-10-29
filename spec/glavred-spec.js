'use babel';

describe("When I run glavred", () => {
    var workspaceElement, editor, editorElement;

    beforeEach(() => {
        workspaceElement = atom.views.getView(atom.workspace);

        waitsForPromise(() => {
            return atom.workspace.open('test.md');
        });
        waitsForPromise(() => {
            return atom.packages.activatePackage('atom-glvrd');
        });
        runs(() => {
            editor = atom.workspace.getActiveTextEditor();
            editorElement = atom.views.getView(editor);
        });
    });

    it("checks and highlights text", () => {
        editor.setText("Суть жизни неизвестна.");
        atom.commands.dispatch(editorElement, 'atom-glvrd:toggle');

        var panels = atom.workspace.getRightPanels();
        expect(panels.length).toBe(1);


        var score = workspaceElement.querySelector('.score-value');
        expect(score.textContent).toBe("??");
    });
});
