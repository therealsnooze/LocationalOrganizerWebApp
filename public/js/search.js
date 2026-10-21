import { h } from './dom.js';
import { api } from './api.js';

export function initSearch({ form, input, results }, { getViewbox, onPick }) {
  const submitBtn = form.querySelector('button[type="submit"]');

  function hide() {
    results.hidden = true;
  }

  function show(...items) {
    results.replaceChildren(...items);
    results.hidden = false;
  }

  // Submit-only (no search-as-you-type) to respect Nominatim's 1 request/second policy.
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;

    submitBtn.disabled = true;
    show(h('li', { class: 'result-empty' }, 'Searching…'));
    try {
      const matches = await api.geocode(query, getViewbox());
      if (!matches.length) {
        show(h('li', { class: 'result-empty' }, 'No matches found.'));
        return;
      }
      show(...matches.map((match) =>
        h('li', {},
          h('button', {
            type: 'button',
            onclick: () => { hide(); onPick(match); },
          },
            h('span', { class: 'result-name' }, match.name),
            h('span', { class: 'result-detail' }, match.displayName),
          ),
        )));
    } catch (err) {
      show(h('li', { class: 'result-empty' }, err.message));
    } finally {
      submitBtn.disabled = false;
    }
  });

  document.addEventListener('click', (e) => {
    if (!form.contains(e.target)) hide();
  });
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
  });
  input.addEventListener('focus', () => {
    if (results.childElementCount) results.hidden = false;
  });
}
