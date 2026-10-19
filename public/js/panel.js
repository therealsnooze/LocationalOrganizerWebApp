import { h, formatBytes, formatDate, formatCoords } from './dom.js';

const ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx';
const MAX_BYTES = 4 * 1024 * 1024; // keep in sync with MAX_FILE_SIZE in server/config.js

export function createPanel(element) {
  function render(...children) {
    element.replaceChildren(...children);
    element.scrollTop = 0;
  }

  function errorBox() {
    const box = h('p', { class: 'error', role: 'alert' });
    box.hidden = true;
    box.show = (message) => { box.textContent = message; box.hidden = false; };
    box.clear = () => { box.hidden = true; };
    return box;
  }

  function showWelcome(placeCount) {
    render(h('div', { class: 'welcome' },
      h('h2', {}, 'Bookmark places in LA County'),
      h('p', {}, 'Click anywhere on the map to drop a pin, or search for an address above. Then attach files to any saved place.'),
      h('div', { class: 'stat' },
        placeCount === 0 ? 'No saved places yet.' : `${placeCount} saved place${placeCount === 1 ? '' : 's'}. Click a pin to open it.`),
    ));
  }

  // Shared by "new place" and "edit place".
  function showForm({ title, lat, lng, name = '', description = '', submitLabel, onSubmit, onCancel }) {
    const nameInput = h('input', { type: 'text', id: 'place-name', value: name, maxLength: 100, required: true });
    const descInput = h('textarea', { id: 'place-description', value: description, maxLength: 2000 });
    const error = errorBox();
    const submitBtn = h('button', { type: 'submit', class: 'btn btn-primary' }, submitLabel);

    const form = h('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        error.clear();
        submitBtn.disabled = true;
        try {
          await onSubmit({ name: nameInput.value.trim(), description: descInput.value.trim() });
        } catch (err) {
          error.show(err.message);
          submitBtn.disabled = false;
        }
      },
    },
      h('h2', {}, title),
      h('p', { class: 'meta' }, formatCoords(lat, lng)),
      h('label', { htmlFor: 'place-name' }, 'Name'),
      nameInput,
      h('label', { htmlFor: 'place-description' }, 'Notes'),
      descInput,
      error,
      h('div', { class: 'btn-row' },
        submitBtn,
        h('button', { type: 'button', class: 'btn', onclick: onCancel }, 'Cancel'),
      ),
    );

    render(form);
    nameInput.focus();
    nameInput.select();
  }

  function showLoading(location) {
    render(h('h2', {}, location.name), h('p', { class: 'meta' }, 'Loading…'));
  }

  function showDetail(location, initialFiles, { onEdit, onDelete, onUpload, onDeleteFile, onClose }) {
    let files = [...initialFiles];
    const error = errorBox();
    const confirmSlot = h('div');
    const fileList = h('ul', { class: 'file-list' });
    const fileInput = h('input', { type: 'file', accept: ACCEPT, multiple: true, hidden: true });

    function renderFiles(pending = []) {
      const items = files.map((file) =>
        h('li', {},
          h('div', { class: 'file-info' },
            h('a', { href: `/api/files/${file.id}`, download: file.original_name, title: file.original_name }, file.original_name),
            h('span', { class: 'meta' }, `${formatBytes(file.size)} · ${formatDate(file.uploaded_at)}`),
          ),
          deleteFileButton(file),
        ));
      const pendingItems = pending.map((name) => h('li', { class: 'uploading' }, `Uploading ${name}…`));
      if (!items.length && !pendingItems.length) {
        fileList.replaceChildren(h('li', { class: 'empty' }, 'No files attached yet.'));
      } else {
        fileList.replaceChildren(...pendingItems, ...items);
      }
    }

    function deleteFileButton(file) {
      let armed = false;
      let timer;
      const btn = h('button', {
        type: 'button',
        class: 'btn btn-danger btn-small',
        'aria-label': `Delete ${file.original_name}`,
        onclick: async () => {
          if (!armed) {
            armed = true;
            btn.textContent = 'Confirm';
            timer = setTimeout(() => { armed = false; btn.textContent = 'Delete'; }, 3000);
            return;
          }
          clearTimeout(timer);
          btn.disabled = true;
          error.clear();
          try {
            await onDeleteFile(file.id);
            files = files.filter((f) => f.id !== file.id);
            renderFiles();
          } catch (err) {
            error.show(err.message);
            btn.disabled = false;
          }
        },
      }, 'Delete');
      return btn;
    }

    async function upload(fileListLike) {
      const chosen = [...fileListLike];
      if (!chosen.length) return;
      error.clear();
      const tooBig = chosen.filter((f) => f.size > MAX_BYTES);
      const ok = chosen.filter((f) => f.size <= MAX_BYTES);
      const problems = tooBig.map((f) => `${f.name}: larger than 4 MB`);

      const pending = ok.map((f) => f.name);
      renderFiles(pending);
      // Sequential keeps ordering predictable and the server load trivial.
      for (const file of ok) {
        try {
          files.unshift(await onUpload(file));
        } catch (err) {
          problems.push(`${file.name}: ${err.message}`);
        }
        pending.shift();
        renderFiles(pending);
      }
      if (problems.length) error.show(problems.join('\n'));
    }

    fileInput.addEventListener('change', () => {
      upload(fileInput.files);
      fileInput.value = '';
    });

    const dropzone = h('div', { class: 'dropzone' },
      'Drop files here or ',
      h('button', { type: 'button', class: 'link-button', onclick: () => fileInput.click() }, 'choose files'),
      h('small', {}, 'Images, PDF, text, CSV, Word, Excel · up to 4 MB each'),
      fileInput,
    );
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      upload(e.dataTransfer.files);
    });

    function showDeleteConfirm() {
      const confirmBtn = h('button', { type: 'button', class: 'btn btn-danger-solid' }, 'Delete place');
      const fileNote = files.length
        ? ` and its ${files.length} attached file${files.length === 1 ? '' : 's'}`
        : '';
      confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        error.clear();
        try {
          await onDelete();
        } catch (err) {
          error.show(err.message);
          confirmBtn.disabled = false;
        }
      });
      confirmSlot.replaceChildren(h('div', { class: 'confirm' },
        h('p', {}, `Delete “${location.name}”${fileNote}? This can't be undone.`),
        h('div', { class: 'btn-row' },
          confirmBtn,
          h('button', { type: 'button', class: 'btn', onclick: () => confirmSlot.replaceChildren() }, 'Cancel'),
        ),
      ));
      confirmBtn.focus();
    }

    render(
      h('h2', {}, location.name),
      h('p', { class: 'meta' }, `${formatCoords(location.lat, location.lng)} · saved ${formatDate(location.created_at)}`),
      location.description
        ? h('p', { class: 'description' }, location.description)
        : h('p', { class: 'description empty' }, 'No notes.'),
      h('div', { class: 'btn-row' },
        h('button', { type: 'button', class: 'btn', onclick: onEdit }, 'Edit'),
        h('button', { type: 'button', class: 'btn btn-danger', onclick: showDeleteConfirm }, 'Delete'),
        h('button', { type: 'button', class: 'btn', onclick: onClose }, 'Close'),
      ),
      confirmSlot,
      h('h3', {}, 'Files'),
      dropzone,
      error,
      fileList,
    );
    renderFiles();
  }

  return { showWelcome, showForm, showLoading, showDetail };
}
