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
		<div class="stats">
			<span class="stats-sentences"></span><br/>
			<span class="stats-words"></span>, <span class="stats-chars"></span>
		</div>
		<div class="hint hidden">
		    <div class="hint-name"></div>
		    <div class="hint-description"></div>
		    <a class="hint-url" href="">Отправить в Главред</a>
		</div>`;
	}

	q(selector) {
		return this.element.querySelector(selector);
	}

	formatPlural(num, a, b, c) {
		if ((num > 4) && (num < 21)) {
			return num + ' ' + a;
		}
		var last_num = (num + '').slice(-1);
		switch (last_num) {
			case '1':
				return num + ' ' + b;
			case '2':
			case '3':
			case '4':
				return num + ' ' + c;
			default:
				return num + ' ' + a;
		}
	}

	serialize() {
	}

	destroy() {
		this.element.remove();
	}

	getElement() {
		return this.element;
	}

	setTextStats(info) {
		var score = info.score || "??";
		var scoreElement = this.q('.score-value');
		scoreElement.textContent = info.score;
		scoreElement.className = 'score-value';
		if (score == "??") {
			scoreElement.classList.add('na');
		}
		else if (score > 7.5) {
			scoreElement.classList.add('fine');
		}
		else if (score < 5) {
			scoreElement.classList.add('poor');
		}
		else {
			scoreElement.classList.add('mediocre');
		}

		if (info.sentences != undefined) {
			var sentences = this.formatPlural(info.sentences, 'предложений', 'предложение', 'предложения');
			var words = this.formatPlural(info.words, 'слов', 'слово', 'слова');
			var chars = this.formatPlural(info.chars, 'букв', 'буква', 'буквы');
			this.q('.stats-sentences').innerText = sentences;
			this.q('.stats-words').innerText = words;
			this.q('.stats-chars').innerText = chars;
		}
	}

	setHint(hint, url) {
		var hintName = this.q('.hint-name');
		hintName.innerHTML = hint.name;

		var hintDescription = this.q('.hint-description');
		hintDescription.innerHTML = /!\?\.$/.test(hint.description) ? hint.description : hint.description + '.';

		if (url) {
			this.q('.hint-url').className = 'hint-url shown';
			var hintUrl = this.q('.hint-url');
			hintUrl.href = url;
		}
		else {
			this.q('.hint-url').className = 'hint-url hidden';
		}
		this.q('.hint').className = 'hint shown';
	}

	resetHints() {
		this.q('.hint').className = 'hint hidden';
	}
}
