import { h } from './dom.js';
import { api } from './api.js';

// Full-screen log in / create account card over the app. prompt() resolves with the
// user once they're in; calling it again while it's open returns the same promise.
export function createAuthScreen(element) {
  let pending = null;

  function prompt(notice = '') {
    pending ??= new Promise((resolve) => {
      element.hidden = false;
      render('login', notice, (user) => {
        element.hidden = true;
        element.replaceChildren();
        pending = null;
        resolve(user);
      });
    });
    return pending;
  }

  function render(mode, notice, done) {
    const isLogin = mode === 'login';
    const username = h('input', {
      type: 'text',
      id: 'auth-username',
      autocomplete: 'username',
      autocapitalize: 'none',
      maxLength: 30,
      required: true,
    });
    const password = h('input', {
      type: 'password',
      id: 'auth-password',
      autocomplete: isLogin ? 'current-password' : 'new-password',
      minLength: isLogin ? null : 8,
      maxLength: 200,
      required: true,
    });
    const error = h('p', { class: 'error', role: 'alert', hidden: !notice }, notice);
    const submitBtn = h('button', { type: 'submit', class: 'btn btn-primary' }, isLogin ? 'Log in' : 'Create account');

    const form = h('form', {
      class: 'auth-card',
      onsubmit: async (e) => {
        e.preventDefault();
        error.hidden = true;
        submitBtn.disabled = true;
        try {
          const credentials = { username: username.value.trim(), password: password.value };
          const { user } = await (isLogin ? api.login(credentials) : api.register(credentials));
          done(user);
        } catch (err) {
          error.textContent = err.message;
          error.hidden = false;
          submitBtn.disabled = false;
        }
      },
    },
      h('div', { class: 'brand' },
        h('span', { class: 'brand-mark', 'aria-hidden': 'true' }),
        h('span', { class: 'brand-name' }, 'Locational Organizer'),
      ),
      h('h2', {}, isLogin ? 'Log in' : 'Create an account'),
      h('p', { class: 'meta' }, isLogin
        ? 'Your saved places and files are private to your account.'
        : 'Pick a username and a password of at least 8 characters.'),
      h('label', { htmlFor: 'auth-username' }, 'Username'),
      username,
      h('label', { htmlFor: 'auth-password' }, 'Password'),
      password,
      error,
      h('div', { class: 'btn-row' }, submitBtn),
      h('p', { class: 'auth-switch' },
        isLogin ? 'New here? ' : 'Already have an account? ',
        h('button', {
          type: 'button',
          class: 'link-button',
          onclick: () => render(isLogin ? 'register' : 'login', '', done),
        }, isLogin ? 'Create an account' : 'Log in'),
      ),
    );

    element.replaceChildren(form);
    username.focus();
  }

  return { prompt };
}
