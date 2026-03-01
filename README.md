# 📚 Bibliothèque Al-Kawthar - Système de Gestion

Système complet de gestion de bibliothèque pour les Écoles Internationales Al-Kawthar avec support multilingue (Arabe, Français, Anglais).

## 🚀 Déploiement sur Vercel

### ⚠️ Configuration CRITIQUE - À FAIRE IMMÉDIATEMENT

**PROBLÈME**: Si le site affiche "0 livres" malgré la présence de données dans MongoDB, c'est que la variable d'environnement n'est pas configurée sur Vercel.

### Étapes de Configuration Vercel (OBLIGATOIRE)

1. **Aller sur Vercel Dashboard**:
   - Visitez: https://vercel.com/dashboard
   - Connectez-vous avec votre compte

2. **Sélectionner votre projet**:
   - Cliquez sur `Library-Alkawthar` (ou le nom de votre projet)

3. **Configurer les variables d'environnement**:
   - Cliquez sur **Settings** (en haut)
   - Dans le menu de gauche, cliquez sur **Environment Variables**
   - Cliquez sur **Add New**
   
4. **Ajouter la variable MongoDB**:
   - **Name (Nom)**: `MONGODB_URI`
   - **Value (Valeur)**: 
     ```
     mongodb+srv://cherifmed2030_db_user:Alkawthar01@library.ve29w9g.mongodb.net/?retryWrites=true&w=majority&appName=Library
     ```
   - **Environment**: Sélectionner `Production`, `Preview`, et `Development` (les 3)
   - Cliquer sur **Save**

5. **Redéployer le projet** (IMPORTANT):
   - Aller dans **Deployments** (en haut)
   - Cliquer sur les 3 points `...` à côté du dernier déploiement
   - Sélectionner **Redeploy**
   - Confirmer le redéploiement

6. **Vérifier la connexion**:
   - Attendez que le déploiement soit terminé (environ 1-2 minutes)
   - Visitez votre site: `https://library-alkawthar.vercel.app`
   - Connectez-vous et vérifiez que les livres se chargent

## 📊 Base de Données MongoDB

- **Provider**: MongoDB Atlas
- **Database**: Library
- **Collections**:
  - `books` - Catalogue des livres
  - `loans` - Prêts actifs
  - `histories` - Historique des prêts

### Initialisation Automatique

Le système initialise automatiquement 8 livres de test si la base de données est vide :
- 3 livres en Anglais
- 3 livres en Français  
- 2 livres en Arabe

## 🔑 Connexion

- **Utilisateur**: `Alkawthar@30`
- **Mot de passe**: `Alkawthar@30`

## ✨ Fonctionnalités

- ✅ Gestion complète des livres (CRUD)
- ✅ Système de prêts pour étudiants et enseignants
- ✅ Scanner de code-barres
- ✅ Import/Export Excel
- ✅ Recherche et tri avancés
- ✅ Statistiques en temps réel
- ✅ Support multilingue (AR/FR/EN)
- ✅ Gestion des dates de retour
- ✅ Historique des prêts
- ✅ Notifications de retard

## 🛠️ Technologies

- **Backend**: Node.js + Express
- **Base de données**: MongoDB Atlas
- **Frontend**: HTML5 + CSS3 + JavaScript vanilla
- **Déploiement**: Vercel
- **Bibliothèques**: Mongoose, Multer, XLSX, jsQR

## 📝 Structure du Projet

```
/
├── api/
│   └── index.js          # API Backend Node.js/Express
├── public/
│   ├── index.html        # Page principale
│   ├── styles.css        # Styles CSS
│   └── scripts.js        # Logic JavaScript
├── package.json          # Dépendances Node.js
├── vercel.json          # Configuration Vercel
└── README.md            # Documentation
```

## 🔧 Développement Local

```bash
# Installer les dépendances
npm install

# Lancer le serveur local
npm start

# Le serveur démarre sur http://localhost:3000
```

## 📞 Support

Pour toute question ou problème, contactez l'équipe technique des Écoles Al-Kawthar.

---

© 2025 Écoles Internationales Al-Kawthar - Tous droits réservés
