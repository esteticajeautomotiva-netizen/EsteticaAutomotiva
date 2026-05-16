// ============================================================
// FIREBASE CONFIG — J&E Estética Automotiva
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyCXWz9bH-5If-hjOhU4AUVRuGcVDKQJwxY",
  authDomain: "estetica-automotiva-751e8.firebaseapp.com",
  projectId: "estetica-automotiva-751e8",
  storageBucket: "estetica-automotiva-751e8.firebasestorage.app",
  messagingSenderId: "656656892551",
  appId: "1:656656892551:web:a4ab38daa9962d72ecae22",
  measurementId: "G-DK31STFCJR"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// ============================================================
// Estrutura das coleções no Firestore:
//
// /services/{id}       → nome, descricao, fotoUrl, duracao(min), preco, ativo
// /gallery/{id}        → fotoUrl, legenda, uploadedAt, semana(YYYY-WW)
// /specialists/{id}    → nome, fone, especialidades[], fotoUrl, userId, ativo
// /appointments/{id}   → clienteNome, clienteFone, serviceId, specialistId,
//                        data(YYYY-MM-DD), hora(HH:MM), status, createdAt
// /settings/horarios   → inicio, fim, diasSemana[]
// /users/{uid}         → role(admin|specialist|client), specialistId
// ============================================================