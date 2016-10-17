'use babel';

export default class AtomGlvrdView {

	constructor(serializedState) {
		// Create root element
		this.element = document.createElement('div');
		this.element.classList.add('atom-glvrd');
		this.element.innerHTML = `
		<div class="score">
			<div class="score-value">--</div>
			<div class="score-text">балла из 10<br/>по шкале Главреда</div>
		</div>
		<div class="hint">
		    <div class="hint-title"></div>
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

		if (score > 7.5) {
			scoreElement.classList.add('fine');
		}
		else if (score < 5) {
			scoreElement.classList.add('bad');
		}
		else {
			scoreElement.classList.add('mediocre');
		}

	}

	setHintText(title, description) {
		var hintTitle = this.element.querySelector('.hint-title');
		hintTitle.textContent = title;
		var hintdescription = this.element.querySelector('.hint-description');
		hintdescription.textContent = description;
	}

	resetHints() {
		this.element.querySelector('.hint-title').textContent = '';
		this.element.querySelector('.hint-description').textContent = '';
	}
}
