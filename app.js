(() => {
  const DEFAULT_EVENT_TYPES = ['Flavortown', 'Stasis', 'Blueprint', 'FuseRing', 'Hack Club HQ'];
  const LEGACY_EVENT_TYPES = ['Shipment', 'Grant', 'Event', 'Sticker Drop', 'Other'];
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
            <small>Shown in dollars as per the Hack Club standard</small>
          </article>
          <article class="stat-card">
            <span class="stat-card__label">Total in GBP</span>
            <strong id="gbpAmount">£0.00</strong>
            <small id="gbpRateLabel">Converted from USD using a NON-live rate</small>
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
              <div class="form-actions__buttons">
                <button type="submit" class="primary-button">Add item</button>
                <button type="button" id="cancelEditButton" class="secondary-button secondary-button--ghost">Cancel edit</button>
              </div>
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
    gbpAmount: document.querySelector('#gbpAmount'),
    gbpRateLabel: document.querySelector('#gbpRateLabel'),
    connectionStatus: document.querySelector('#connectionStatus'),
    entryForm: document.querySelector('#entryForm'),
    eventTypeForm: document.querySelector('#eventTypeForm'),
    eventTypeSelect: document.querySelector('#eventTypeSelect'),
    eventTypeList: document.querySelector('#eventTypeList'),
    entriesList: document.querySelector('#entriesList'),
    formFeedback: document.querySelector('#formFeedback'),
    cancelEditButton: document.querySelector('#cancelEditButton'),
  };

  const state = {
    entries: [],
    eventTypes: [...DEFAULT_EVENT_TYPES],
    editingEntryId: null,
    usdToGbpRate: 0.79,
  };

  const entryFormButton = () => elements.entryForm.querySelector('button[type="submit"]');

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);

  const formatCurrencyGbp = (value) =>
    new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
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

  const normalizeEventTypes = (eventTypes) =>
    [...new Set(eventTypes.filter(Boolean).filter((eventType) => !LEGACY_EVENT_TYPES.some((legacyType) => normalizeType(legacyType) === normalizeType(eventType))))];

  const getEntryFormValues = () => {
    const formData = new FormData(elements.entryForm);
    return {
      name: String(formData.get('name') ?? '').trim(),
      date: String(formData.get('date') ?? '').trim(),
      eventType: String(formData.get('eventType') ?? '').trim(),
      amount: Number.parseFloat(String(formData.get('amount') ?? '0')),
      notes: String(formData.get('notes') ?? '').trim(),
    };
  };

  const clearEntryEditor = () => {
    state.editingEntryId = null;
    elements.entryForm.reset();
    entryFormButton().textContent = 'Add item';
    elements.cancelEditButton.hidden = true;
    setFeedback('');
    elements.eventTypeSelect.value = state.eventTypes[0] ?? '';
  };

  const startEditingEntry = (entryId) => {
    const entry = state.entries.find((item) => item.id === entryId);
    if (!entry) {
      setFeedback('That entry could not be found.', 'danger');
      return;
    }

    state.editingEntryId = entryId;
    elements.entryForm.name.value = entry.name ?? '';
    elements.entryForm.date.value = entry.date ?? '';
    elements.entryForm.amount.value = entry.amount ?? '';
    elements.entryForm.notes.value = entry.notes ?? '';
    renderEventTypes();
    if (state.eventTypes.some((eventType) => normalizeType(eventType) === normalizeType(entry.eventType))) {
      elements.eventTypeSelect.value = entry.eventType;
    } else {
      elements.eventTypeSelect.value = entry.eventType;
    }
    entryFormButton().textContent = 'Save changes';
    elements.cancelEditButton.hidden = false;
    setFeedback(`Editing ${entry.name}.`, 'warning');
  };

  const syncEntryState = (nextEntries) => {
    state.entries = nextEntries;

    if (state.editingEntryId && !state.entries.some((entry) => entry.id === state.editingEntryId)) {
      clearEntryEditor();
    }

    renderEntries();
  };

  const updateLocalEntry = (entryId, patch) => {
    syncEntryState(
      state.entries.map((entry) => (entry.id === entryId ? { ...entry, ...patch } : entry)),
    );
    writeLocalState(STORAGE_KEYS.demoEntries, state.entries);
  };

  const deleteLocalEntry = (entryId) => {
    syncEntryState(state.entries.filter((entry) => entry.id !== entryId));
    writeLocalState(STORAGE_KEYS.demoEntries, state.entries);
  };

  const updateSummary = () => {
    const total = state.entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const gbpTotal = total * state.usdToGbpRate;
    elements.totalAmount.textContent = formatCurrency(total);
    elements.gbpAmount.textContent = formatCurrencyGbp(gbpTotal);
    elements.gbpRateLabel.textContent = `Converted at $1 = £${state.usdToGbpRate.toFixed(4)}`;
  };

  const renderEventTypes = () => {
    state.eventTypes = normalizeEventTypes([
      ...DEFAULT_EVENT_TYPES,
      ...state.eventTypes,
      ...state.entries.map((entry) => entry.eventType),
    ]);

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
            <div class="entry-card__actions">
              <button type="button" class="ghost-button" data-entry-action="edit" data-entry-id="${entry.id}">Edit</button>
              <button type="button" class="ghost-button ghost-button--danger" data-entry-action="delete" data-entry-id="${entry.id}">Delete</button>
            </div>
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

  const describeFirebaseError = (error) => {
    if (!error) {
      return 'Unknown Firebase error';
    }

    return error.code ? `${error.code}: ${error.message ?? 'Request failed'}` : (error.message ?? String(error));
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
    const savedTypes = readLocalState(STORAGE_KEYS.demoEventTypes, DEFAULT_EVENT_TYPES);
    state.eventTypes = normalizeEventTypes([
      ...DEFAULT_EVENT_TYPES,
      ...savedTypes,
      ...state.entries.map((entry) => entry.eventType),
    ]);
    renderEventTypes();
    renderEntries();
    setStatus('Demo mode', 'warning');
  };

  const refreshExchangeRate = async () => {
    try {
      const response = await fetch('https://api.frankfurter.app/latest?from=USD&to=GBP');
      if (!response.ok) {
        throw new Error(`Rate request failed with ${response.status}`);
      }

      const data = await response.json();
      const rate = Number(data?.rates?.GBP);

      if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error('Invalid GBP rate returned from the API');
      }

      state.usdToGbpRate = rate;
      elements.gbpRateLabel.textContent = `Converted at $1 = £${rate.toFixed(4)} (live)`;
      updateSummary();
    } catch (error) {
      console.error(error);
      elements.gbpRateLabel.textContent = `Converted using fallback rate of $1 = £${state.usdToGbpRate.toFixed(4)}`;
    }
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

  const deleteFirebaseEntry = async (entryId) => {
    await firestore.collection('entries').doc(entryId).delete();
  };

  const updateFirebaseEntry = async (entryId, patch) => {
    await firestore.collection('entries').doc(entryId).update(patch);
  };

  const deleteFirebaseEventType = async (eventTypeId) => {
    await firestore.collection('eventTypes').doc(eventTypeId).delete();
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
    const existingNames = new Set(
      existingTypes.docs.map((doc) => normalizeType(doc.data().name ?? '')),
    );

    for (const eventType of DEFAULT_EVENT_TYPES) {
      if (existingNames.has(normalizeType(eventType))) {
        continue;
      }

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
        state.eventTypes = normalizeEventTypes([
          ...DEFAULT_EVENT_TYPES,
          ...state.eventTypes,
          ...state.entries.map((entry) => entry.eventType),
        ]);
        renderEntries();
        renderEventTypes();
        setStatus('Connected to Firebase', 'success');
      }, (error) => {
        console.error(error);
        setStatus('Entries listener failed', 'danger');
        setFeedback(`Firebase entries listener error: ${describeFirebaseError(error)}`, 'danger');
      });

      unsubEventTypes = eventTypesQuery.onSnapshot((snapshot) => {
        const remoteTypes = snapshot.docs
          .map((doc) => doc.data().name)
          .filter(Boolean)
          .filter((eventType) => !LEGACY_EVENT_TYPES.some((legacyType) => normalizeType(legacyType) === normalizeType(eventType)));
        state.eventTypes = [...new Set([...DEFAULT_EVENT_TYPES, ...remoteTypes])];
        renderEventTypes();
      }, (error) => {
        console.error(error);
        setStatus('Event types listener failed', 'danger');
        setFeedback(`Firebase event type listener error: ${describeFirebaseError(error)}`, 'danger');
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
        setFeedback(`Could not save the new event type: ${describeFirebaseError(error)}`, 'danger');
      });
    } else {
      addLocalType(name);
    }

    elements.eventTypeSelect.value = name;
  });

  elements.entryForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setFeedback('');

    const { name, date, eventType, amount, notes } = getEntryFormValues();

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
        if (state.editingEntryId) {
          await updateFirebaseEntry(state.editingEntryId, {
            name,
            date,
            eventType,
            amount,
            notes,
            updatedAt: Date.now(),
          });
          setFeedback('Changes saved to Firebase.', 'success');
        } else {
          await firestore.collection('entries').add(payload);
          setFeedback('Saved to Firebase.', 'success');
        }
        clearEntryEditor();
      } catch (error) {
        console.error(error);
        setFeedback(`The item could not be saved: ${describeFirebaseError(error)}`, 'danger');
      }
      return;
    }

    if (state.editingEntryId) {
      updateLocalEntry(state.editingEntryId, {
        name,
        date,
        eventType,
        amount,
        notes,
        updatedAt: Date.now(),
      });
      setFeedback('Changes saved locally in demo mode.', 'success');
      clearEntryEditor();
      return;
    }

    addLocalEntry(payload);
    setFeedback('Saved locally in demo mode.', 'success');
    clearEntryEditor();
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
        setFeedback(`Could not add that event type: ${describeFirebaseError(error)}`, 'danger');
      }
      return;
    }

    addLocalType(typeName);
    setFeedback('Event type added locally.', 'success');
    elements.eventTypeForm.reset();
  });

  elements.entriesList.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-entry-action]');
    if (!button) {
      return;
    }

    const entryId = button.dataset.entryId;
    const action = button.dataset.entryAction;
    if (!entryId || !action) {
      return;
    }

    if (action === 'edit') {
      startEditingEntry(entryId);
      return;
    }

    if (action === 'delete') {
      const entry = state.entries.find((item) => item.id === entryId);
      if (!entry) {
        setFeedback('That entry was not found.', 'danger');
        return;
      }

      const confirmed = window.confirm(`Delete ${entry.name}? This cannot be undone.`);
      if (!confirmed) {
        return;
      }

      try {
        if (firebaseAvailable && firestore) {
          await deleteFirebaseEntry(entryId);
        } else {
          deleteLocalEntry(entryId);
        }

        if (state.editingEntryId === entryId) {
          clearEntryEditor();
        }

        setFeedback('Entry removed.', 'success');
      } catch (error) {
        console.error(error);
        setFeedback(`Could not delete the entry: ${describeFirebaseError(error)}`, 'danger');
      }
    }
  });

  if (firebaseAvailable) {
    bootstrap();
    refreshExchangeRate();
  } else {
    syncDemoState();
    setStatus('Demo mode', 'warning');
  }

  elements.cancelEditButton.hidden = true;
  elements.cancelEditButton.addEventListener('click', () => {
    clearEntryEditor();
    setFeedback('Edit cancelled.', 'neutral');
  });

  window.addEventListener('beforeunload', () => {
    unsubEntries?.();
    unsubEventTypes?.();
  });
})();
