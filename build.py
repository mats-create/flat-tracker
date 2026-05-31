"""
build.py — Flat Tracker index.html assembler
Concatenates src/ files into a single deployable index.html
"""

HTML_HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#1565C0">
<meta name="description" content="Flat Tracker — instant apartment alerts for your streets">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>Flat Tracker</title>
<link rel="manifest" href="manifest.json">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">

<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.2/babel.min.js"></script>

<script type="module">
  import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
  import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
  import { getFirestore, collection, doc, setDoc, addDoc, updateDoc, deleteDoc, getDoc,
    getDocs, onSnapshot, query, orderBy, where, serverTimestamp }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

  const firebaseConfig = {
    apiKey: "REPLACE_WITH_YOUR_API_KEY",
    authDomain: "REPLACE_WITH_YOUR_AUTH_DOMAIN",
    projectId: "REPLACE_WITH_YOUR_PROJECT_ID",
    storageBucket: "REPLACE_WITH_YOUR_STORAGE_BUCKET",
    messagingSenderId: "REPLACE_WITH_YOUR_SENDER_ID",
    appId: "REPLACE_WITH_YOUR_APP_ID"
  };

  const app  = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db   = getFirestore(app);

  window.__firebase = {
    auth, db, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
    collection, doc, setDoc, addDoc, updateDoc, deleteDoc, getDoc,
    getDocs, onSnapshot, query, orderBy, where, serverTimestamp
  };
</script>

<style>
"""

HTML_STYLE_END = """</style>
</head>
<body>
<div id="root"></div>

<script type="text/babel">
"""

HTML_FOOT = """</script>
</body>
</html>
"""

# Source files in assembly order
JS_FILES = [
    'src/constants.js',
    'src/utils.js',
    'src/firebase.js',
    'src/components.js',
    'src/screens.js',
    'src/app.js',
]

def read(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def build():
    parts = []
    parts.append(HTML_HEAD)
    parts.append(read('src/style.css'))
    parts.append(HTML_STYLE_END)
    for path in JS_FILES:
        parts.append(f'\n/* ---- {path} ---- */\n')
        parts.append(read(path))
    parts.append(HTML_FOOT)

    output = ''.join(parts)
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(output)

    lines = output.count('\n')
    print(f'Built index.html — {lines} lines')

if __name__ == '__main__':
    build()
