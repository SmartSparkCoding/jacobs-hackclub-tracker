# jacobs-hackclub-tracker
A sleek tracker for Jacob's Hack Club shipments, grants, and other items. The dashboard shows the running total in dollars at the top of the page and lets you add a name, date, event type, notes, and amount for every entry.

## Firebase setup

1. Create a Firebase project.
2. Enable Cloud Firestore and create the database.
3. The web app config is already wired into [app.js](app.js), so you do not need a local `.env` file.
4. If you want the database to be fully public while testing, paste the rules from [firestore.rules](firestore.rules) into the Firestore rules editor.
5. Start the app and add your first event types. The database will create the collections automatically on first write.

## Data model

The app uses two collections:

- `entries` stores each shipment or grant with `name`, `date`, `eventType`, `notes`, `amount`, and `createdAt`.
- `eventTypes` stores the selectable categories shown in the form.

## Local development

Open [index.html](index.html) directly in your browser, or serve the folder with any static file server if you prefer.

## Public Firestore rules

Use these rules if you want the database to be fully public during setup or testing:

```txt
rules_version = '2';
service cloud.firestore {
	match /databases/{database}/documents {
		match /{document=**} {
			allow read, write: if true;
		}
	}
}
```
