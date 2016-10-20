'use babel';

export default class AtomGlvrdView {

	constructor() {
		// Create root element
		this.element = document.createElement('div');
		this.element.classList.add('atom-glvrd');
		this.element.innerHTML = `
		<div class="score">
			<div class="score-value">--</div>
			<div class="score-text">балла из 10<br/>по шкале Главреда</div>
		</div>
		<div class="hint">
		    <div class="hint-name"></div>
		    <div class="hint-description"></div>
		</div>`;
	}

	// Returns an object that can be retrieved when package is activated
	serialize() {
	}

	// Tear down any state and detach
	destroy() {
		this.element.remove();
	}

	getElement() {
		return this.element;
	}

	setScore(score) {
		var scoreElement = this.element.querySelector('.score-value');
		scoreElement.textContent = score;
		scoreElement.className = 'score-value';

		score = parseFloat(score);
		if (score > 7.5) {
			scoreElement.classList.add('fine');
		}
		else if (score < 5) {
			scoreElement.classList.add('poor');
		}
		else {
			scoreElement.classList.add('mediocre');
		}
	}

	setHint(hint) {
		var hintName = this.element.querySelector('.hint-name');
		hintName.innerHTML = hint.name;
		var hintDescription = this.element.querySelector('.hint-description');
		hintDescription.innerHTML = hint.description;
	}

	resetHints() {
		this.element.querySelector('.hint-name').innerHTML = '';
		this.element.querySelector('.hint-description').innerHTML = '';
	}
}
