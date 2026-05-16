// ============================================================
// AUTH.JS — Autenticação e controle de sessão
// ============================================================

// Login com email/senha
async function loginUser(email, password) {
  try {
    const result = await auth.signInWithEmailAndPassword(email, password);
    const userDoc = await db.collection("users").doc(result.user.uid).get();
    if (!userDoc.exists) throw new Error("Usuário não encontrado no sistema");
    return { uid: result.user.uid, ...userDoc.data() };
  } catch (e) {
    throw new Error(translateFirebaseError(e.code) || e.message);
  }
}

// Logout
async function logoutUser() {
  await auth.signOut();
  window.location.href = "login.html";
}

// Verificar sessão ativa e redirecionar conforme papel
function checkSession(requiredRole) {
  return new Promise((resolve, reject) => {
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = "login.html";
        return reject("Não autenticado");
      }
      const userDoc = await db.collection("users").doc(user.uid).get();
      if (!userDoc.exists) {
        await auth.signOut();
        window.location.href = "login.html";
        return reject("Sem perfil");
      }
      const userData = { uid: user.uid, email: user.email, ...userDoc.data() };

      if (requiredRole && userData.role !== requiredRole) {
        // Redireciona para página correta conforme papel
        if (userData.role === "admin") window.location.href = "admin.html";
        else if (userData.role === "specialist") window.location.href = "specialist.html";
        else window.location.href = "index.html";
        return reject("Papel incorreto");
      }
      resolve(userData);
    });
  });
}

// Criar usuário especialista pelo admin (sem mudar sessão do admin)
async function createSpecialistUser(email, password, specialistData) {
  // Usa uma instância secundária para não deslogar o admin
  const secondaryApp = firebase.initializeApp(firebaseConfig, "secondary");
  try {
    const cred = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;

    // Criar doc do usuário
    await db.collection("users").doc(uid).set({
      role: "specialist",
      specialistId: specialistData.id,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await secondaryApp.auth().signOut();
    return uid;
  } finally {
    secondaryApp.delete();
  }
}

// Recuperar senha
async function resetPassword(email) {
  await auth.sendPasswordResetEmail(email);
}

// Tradução de erros Firebase
function translateFirebaseError(code) {
  const map = {
    "auth/user-not-found": "E-mail não encontrado",
    "auth/wrong-password": "Senha incorreta",
    "auth/invalid-email": "E-mail inválido",
    "auth/too-many-requests": "Muitas tentativas. Tente mais tarde",
    "auth/email-already-in-use": "E-mail já cadastrado"
  };
  return map[code] || null;
}
