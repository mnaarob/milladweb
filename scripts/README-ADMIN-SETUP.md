# Admin Setup: Set Admin Custom Claim

This guide explains how to grant admin access to a user so they can log in to the admin panel.

## Prerequisites

- Node.js installed
- A Firebase user account (create in Firebase Console > Authentication > Users)

## Step 1: Install dependencies

From the project root:

```bash
npm install
```

## Step 2: Get the service account key

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (**milladweb-aec90**)
3. Click the gear icon → **Project Settings**
4. Open the **Service Accounts** tab
5. Click **Generate new private key** → Confirm
6. Save the downloaded JSON file as:
   ```
   milladweb/scripts/serviceAccountKey.json
   ```

**Important:** This file contains secrets. It is in `.gitignore` — do not commit it.

## Step 3: Create the admin user (if not already created)

1. In Firebase Console, go to **Authentication** → **Users**
2. Click **Add user**
3. Enter the email and password for your admin account
4. Click **Add user**

## Step 4: Run the script

Replace `admin@yourdomain.com` with your admin email:

```bash
node scripts/set-admin-claim.js admin@yourdomain.com
```

Or using npm:

```bash
npm run set-admin -- admin@yourdomain.com
```

## Step 5: Sign in

1. Open `admin.html` in your browser (or your deployed admin URL)
2. Enter the email and password you created
3. Click **Sign In**

You should now have access to the admin panel (Orders, Products).
