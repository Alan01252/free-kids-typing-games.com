(() => {
  const library = document.querySelector('[data-game-library]');
  if (!library) return;
  const filters = library.querySelector('[data-game-filters]');
  const buttons = Array.from(filters.querySelectorAll('[data-game-filter]'));
  const cards = Array.from(library.querySelectorAll('[data-game-skill]'));
  const count = library.querySelector('[data-game-count]');
  filters.hidden = false;
  buttons.forEach(button => button.addEventListener('click', () => {
    const skill = button.dataset.gameFilter;
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    let visible = 0;
    cards.forEach(card => {
      card.hidden = skill !== 'all' && card.dataset.gameSkill !== skill;
      if (!card.hidden) visible += 1;
    });
    count.textContent = `${visible} ${visible === 1 ? 'game' : 'games'} to explore`;
  }));
})();
