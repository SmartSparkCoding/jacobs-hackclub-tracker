(() => {
  const DEFAULT_EVENT_TYPES = ['Shipment', 'Grant', 'Event', 'Sticker Drop', 'Other'];
  const STORAGE_KEYS = {
    demoEntries: 'jacobs-tracker-demo-entries',
    demoEventTypes: 'jacobs-tracker-demo-event-types',
  };

  const firebaseConfig = {
    apiKey: 'AIzaSyC7YLaVqTodPwUIsM5pUoGtb2rMpS6v5sg',
    authDomain: 'jacob-hackclub-tracker.firebaseapp.com',
    projectId: 'jacob-hackclub-tracker',
    storageBucket: 'jacob-hackclub-tracker.firebasestorage.app',
    messagingSenderId: '873742360398',
    appId: '1:873742360398:web:32a28ffa1f68ca9f9f481f',
  };

  const appRoot = document.querySelector('#app');

  appRoot.innerHTML = `
    <main class="shell">
      <section class="hero panel">
        <div class="hero__copy">
          <p class="eyebrow">Jacob's Hack Club tracker</p>
          <h1>Track shipments, notes, and the money attached to every item.</h1>
          <p class="hero__lede">
            A clean dashboard for keeping a public Firebase-backed record of what Jacob receives,
            when it arrived, and how much it was worth.
          </p>
        </div>
        <div class="hero__stats">
          <article class="stat-card stat-card--primary">
            <span class="stat-card__label">Total amount</span>
            <strong id="totalAmount">$0.00</strong>
            <small>Shown in dollars at the top of the page</small>
          </article>
          <article class="stat-card">
            <span class="stat-card__label">Tracked items</span>
            <strong id="entryCount">0</strong>
            <small>Saved entries across every event type</small>
          </article>
        </div>
      </section>

      <section class="content-grid">
        <section class="panel form-panel">
          <div class="panel__header">
            <div>
              <p class="section-kicker">New entry</p>
              <h2>Add a shipment or grant</h2>
            </div>
            <span class="status-pill" id="connectionStatus">Loading data…</span>
          </div>

          <form id="entryForm" class="entry-form">
            <label>
              <span>Name</span>
              <input name="name" type="text" placeholder="Example: Solar Panel Kit" required maxlength="80" />
            </label>
            <label>
              <span>Date</span>
              <input name="date" type="date" required />
            </label>
            <label>
              <span>Event Type</span>
              <select name="eventType" id="eventTypeSelect" required></select>
            </label>
            <label>
              <span>Amount</span>
              <input name="amount" type="number" min="0" step="0.01" placeholder="0.00" required />
            </label>
            <label class="field--full">
              <span>Notes</span>
              <textarea name="notes" rows="4" placeholder="Optional notes about the item, source, or delivery"></textarea>
            </label>
            <div class="form-actions field--full">
              <button type="submit" class="primary-button">Add item</button>
              <p id="formFeedback" class="form-feedback"></p>
            </div>
          </form>
        </section>

        <section class="panel types-panel">
          <div class="panel__header">
            <div>
              <p class="section-kicker">Event types</p>
              <h2>Manage the list</h2>
            </div>
          </div>

          <form id="eventTypeForm" class="type-form">
            <input name="eventTypeName" type="text" placeholder="Add a new event type" maxlength="40" required />
            <button type="submit" class="secondary-button">Add type</button>
          </form>

          <div id="eventTypeList" class="type-list" aria-live="polite"></div>
        </section>
      </section>

      <section class="panel entries-panel">
        <div class="panel__header">
          <div>
            <p class="section-kicker">Saved data</p>
            <h2>Recent tracker entries</h2>
          </div>
        </div>
        <div id="entriesList" class="entries-list"></div>
      </section>
    </main>
  `;

  const elements = {
    totalAmount: document.querySelector('#totalAmount'),
    entryCount: document.querySelector('#entryCount'),
    connectionStatus: document.querySelector('#connectionStatus'),
    entryForm: document.querySelector('#entryForm'),
    eventTypeForm: document.querySelector('#eventTypeForm'),
    eventTypeSelect: document.querySelector('#eventTypeSelect'),
    eventTypeList: document.querySelector('#eventTypeList'),
    entriesList: document.querySelector('#entriesList'),
    formFeedback: document.querySelector('#formFeedback'),
  };

  const state = {
    entries: [],
    eventTypes: [...DEFAULT_EVENT_TYPES],
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);

  const formatDate = (value) => {
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }).format(date);
  };

  const normalizeType = (value) => value.trim().toLowerCase();

  const updateSummary = () => {
    const total = state.entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    elements.totalAmount.textContent = formatCurrency(total);
    elements.entryCount.textContent = `${state.entries.length}`;
  };

  const renderEventTypes = () => {
    const options = state.eventTypes
      .map((eventType) => `<option value="${eventType}">${eventType}</option>`)
      .join('');

    elements.eventTypeSelect.innerHTML = `${options}<option value="__add_new__">+ Add new type…</option>`;

    elements.eventTypeList.innerHTML = state.eventTypes
      .map((eventType) => `<span class="type-chip">${eventType}</span>`)
      .join('');

    if (!elements.eventTypeSelect.value) {
      elements.eventTypeSelect.value = state.eventTypes[0] ?? '';
    }
  };

  const renderEntries = () => {
    if (!state.entries.length) {
      elements.entriesList.innerHTML = `
        <article class="empty-state">
          <h3>No entries yet</h3>
          <p>Add your first shipment or grant using the form above. The total will update instantly.</p>
        </article>
      `;
      updateSummary();
      return;
    }

    elements.entriesList.innerHTML = state.entries
      .map(
        (entry) => `
          <article class="entry-card">
            <div class="entry-card__top">
              <div>
                <h3>${entry.name}</h3>
                <p>${formatDate(entry.date)} · ${entry.eventType}</p>
              </div>
              <strong>${formatCurrency(entry.amount)}</strong>
            </div>
            <p class="entry-card__notes">${entry.notes || 'No notes added.'}</p>
          </article>
        `,
      )
      .join('');

    updateSummary();
  };

  const setStatus = (message, tone = 'neutral') => {
    elements.connectionStatus.textContent = message;
    elements.connectionStatus.dataset.tone = tone;
  };

  const setFeedback = (message, tone = 'neutral') => {
    elements.formFeedback.textContent = message;
    elements.formFeedback.dataset.tone = tone;
  };

  const readLocalState = (key, fallback) => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const writeLocalState = (key, value) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  };

  const syncDemoState = () => {
    state.entries = readLocalState(STORAGE_KEYS.demoEntries, []);
    state.eventTypes = readLocalState(STORAGE_KEYS.demoEventTypes, DEFAULT_EVENT_TYPES);
    renderEventTypes();
    renderEntries();
    setStatus('Demo mode', 'warning');
  };

  const addLocalEntry = (entry) => {
    state.entries = [
      {
        ...entry,
        id: crypto.randomUUID(),
        amount: Number(entry.amount),
      },
      ...state.entries,
    ];
    writeLocalState(STORAGE_KEYS.demoEntries, state.entries);
    renderEntries();
  };

  const addLocalType = (typeName) => {
    state.eventTypes = [typeName, ...state.eventTypes.filter((item) => normalizeType(item) !== normalizeType(typeName))];
    writeLocalState(STORAGE_KEYS.demoEventTypes, state.eventTypes);
    renderEventTypes();
  };

  const firebaseAvailable = Boolean(window.firebase?.initializeApp) && Boolean(window.firebase?.firestore);
  let firestore = null;
  let unsubEntries = null;
  let unsubEventTypes = null;

  const ensureDefaultTypes = async () => {
    if (!firebaseAvailable) {
      return;
    }

    const existingTypes = await firestore.collection('eventTypes').get();

    if (!existingTypes.empty) {
      return;
    }

    for (const eventType of DEFAULT_EVENT_TYPES) {
      await firestore.collection('eventTypes').add({
        name: eventType,
        createdAt: Date.now(),
      });
    }
  };

  const bootstrap = async () => {
    if (!firebaseAvailable) {
      syncDemoState();
      return;
    }

    try {
      window.firebase.initializeApp(firebaseConfig);
      firestore = window.firebase.firestore();

      await ensureDefaultTypes();
      renderEventTypes();
      renderEntries();

      const entriesQuery = firestore.collection('entries').orderBy('createdAt', 'desc');
      const eventTypesQuery = firestore.collection('eventTypes').orderBy('createdAt', 'asc');

      unsubEntries = entriesQuery.onSnapshot((snapshot) => {
        state.entries = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        renderEntries();
        setStatus('Connected to Firebase', 'success');
      });

      unsubEventTypes = eventTypesQuery.onSnapshot((snapshot) => {
        const remoteTypes = snapshot.docs.map((doc) => doc.data().name).filter(Boolean);
        state.eventTypes = [...new Set([...DEFAULT_EVENT_TYPES, ...remoteTypes])];
        renderEventTypes();
      });
    } catch (error) {
      console.error(error);
      syncDemoState();
      setStatus('Firebase unavailable, using local demo mode', 'warning');
    }
  };

  elements.eventTypeSelect.addEventListener('change', () => {
    if (elements.eventTypeSelect.value !== '__add_new__') {
      return;
    }

    const customType = window.prompt('Enter a new event type');
    if (!customType?.trim()) {
      elements.eventTypeSelect.value = state.eventTypes[0] ?? '';
      return;
    }

    const name = customType.trim();
    const exists = state.eventTypes.some((eventType) => normalizeType(eventType) === normalizeType(name));

    if (exists) {
      elements.eventTypeSelect.value = name;
      return;
    }

    if (firebaseAvailable && firestore) {
      firestore.collection('eventTypes').add({
        name,
        createdAt: Date.now(),
      }).catch((error) => {
        console.error(error);
        setFeedback('Could not save the new event type.', 'danger');
      });
    } else {
      addLocalType(name);
    }

    elements.eventTypeSelect.value = name;
  });

  elements.entryForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setFeedback('');

    const formData = new FormData(elements.entryForm);
    const name = String(formData.get('name') ?? '').trim();
    const date = String(formData.get('date') ?? '').trim();
    const eventType = String(formData.get('eventType') ?? '').trim();
    const amount = Number.parseFloat(String(formData.get('amount') ?? '0'));
    const notes = String(formData.get('notes') ?? '').trim();

    if (!name || !date || !eventType || Number.isNaN(amount)) {
      setFeedback('Please complete every required field.', 'danger');
      return;
    }

    const payload = {
      name,
      date,
      eventType,
      amount,
      notes,
      createdAt: Date.now(),
    };

    if (firebaseAvailable && firestore) {
      try {
        await firestore.collection('entries').add(payload);
        setFeedback('Saved to Firebase.', 'success');
        elements.entryForm.reset();
        elements.eventTypeSelect.value = state.eventTypes[0] ?? '';
      } catch (error) {
        console.error(error);
        setFeedback('The item could not be saved.', 'danger');
      }
      return;
    }

    addLocalEntry(payload);
    setFeedback('Saved locally in demo mode.', 'success');
    elements.entryForm.reset();
    elements.eventTypeSelect.value = state.eventTypes[0] ?? '';
  });

  elements.eventTypeForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const input = new FormData(elements.eventTypeForm);
    const typeName = String(input.get('eventTypeName') ?? '').trim();

    if (!typeName) {
      return;
    }

    const exists = state.eventTypes.some((eventType) => normalizeType(eventType) === normalizeType(typeName));
    if (exists) {
      setFeedback('That event type already exists.', 'warning');
      return;
    }

    if (firebaseAvailable && firestore) {
      try {
        await firestore.collection('eventTypes').add({
          name: typeName,
          createdAt: Date.now(),
        });
        setFeedback('Event type added.', 'success');
        elements.eventTypeForm.reset();
      } catch (error) {
        console.error(error);
        setFeedback('Could not add that event type.', 'danger');
      }
      return;
    }

    addLocalType(typeName);
    setFeedback('Event type added locally.', 'success');
    elements.eventTypeForm.reset();
  });

  if (firebaseAvailable) {
    bootstrap();
  } else {
    syncDemoState();
    setStatus('Demo mode', 'warning');
  }

  window.addEventListener('beforeunload', () => {
    unsubEntries?.();
    unsubEventTypes?.();
  });
})();
