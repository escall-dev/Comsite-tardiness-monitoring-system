# Tardiness Monitoring System

A comprehensive web-based tardiness monitoring system built with Firebase, featuring real-time tracking, offline support, and multiple export options.

## 🚀 Features

### Core Functionality
- **Dual Entry Modes**: Manual entry with full student details and Quick Select for bulk logging
- **Real-time Clock**: Live time and date display
- **School Branding**: Integrated school logo and professional design
- **Dynamic Data Table**: Real-time updates with edit/delete capabilities

### Data Management
- **Firebase Integration**: Cloud-based data storage with real-time synchronization
- **Offline Support**: Local storage backup with sync when reconnected
- **Search & Filter**: Advanced filtering by name, grade, strand, and section
- **Sort Options**: Date ascending/descending sorting

### Export Capabilities
- **Excel Export**: Complete data export with formatting
- **PDF Export**: Professional reports with school branding
- **Image Export**: Screenshot-style exports for sharing

### User Experience
- **Dark Mode**: Toggle between light and dark themes
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Toast Notifications**: Real-time feedback for all actions
- **Persistent Preferences**: Remembers user settings and last used mode

### Summary Analytics
- **Today's Lates**: Real-time count of today's tardy entries
- **Weekly Summary**: Count of lates for the current week
- **Monthly Summary**: Count of lates for the current month

## 🛠️ Setup Instructions

### 1. Firebase Configuration

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Firestore Database in your project
3. Set up Firestore security rules (see below)
4. Get your Firebase configuration:
   - Go to Project Settings
   - Scroll down to "Your apps"
   - Click the web icon (</>) to add a web app
   - Copy the configuration object

### 2. Update Firebase Config

Open `firebase-config.js` and replace the placeholder configuration with your actual Firebase config:

```javascript
const firebaseConfig = {
    apiKey: "your-actual-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-actual-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
};
```

### 3. Firestore Security Rules

Set up the following security rules in your Firestore database:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tardiness/{document} {
      allow read, write: if true; // For development - customize for production
    }
  }
}
```

### 4. Deploy the Application

#### Option A: Local Development
1. Install a local web server (e.g., Live Server extension in VS Code)
2. Open the project folder
3. Start the server and navigate to `index.html`

#### Option B: Firebase Hosting
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login to Firebase: `firebase login`
3. Initialize hosting: `firebase init hosting`
4. Deploy: `firebase deploy`

#### Option C: Traditional Web Server
Upload all files to your web server's public directory.

## 📱 Usage Guide

### Manual Mode
1. Enter the student's full name
2. Select Grade, Strand, and Section from dropdowns
3. Click "Record Late Entry"
4. Entry is automatically saved with current timestamp

### Quick Select Mode
1. Click on any Grade-Strand-Section button
2. System automatically records a late entry for that group
3. Ideal for high-speed logging situations

### Data Management
- **Search**: Use the search bar to find specific entries
- **Filter**: Use dropdown filters to narrow results by grade, strand, or section
- **Sort**: Choose date ascending or descending order
- **Edit**: Click the edit button to modify any entry
- **Delete**: Click the delete button to remove entries

### Export Options
- **Excel**: Downloads a formatted Excel file with all filtered data
- **PDF**: Creates a professional PDF report with summary statistics
- **Image**: Exports the current table view as a PNG image

### Theme Toggle
- Click the moon/sun icon in the header to switch between light and dark themes
- Your preference is automatically saved

## 🔧 Customization

### Adding New Grades/Strands/Sections
Edit the HTML file to add new options in the dropdown menus:

```html
<option value="13">Grade 13</option>
<option value="ARTS">ARTS</option>
<option value="F">F</option>
```

### Modifying Quick Select Buttons
Add or modify buttons in the quick select grid:

```html
<button class="quick-select-btn" data-grade="10" data-strand="STEM" data-section="A">
    <span class="grade">10</span>
    <span class="strand">STEM</span>
    <span class="section">A</span>
</button>
```

### Styling Customization
The CSS uses CSS variables for easy theming. Modify the `:root` section in `styles.css`:

```css
:root {
    --primary-color: #your-color;
    --secondary-color: #your-color;
    /* ... other variables */
}
```

## 🔒 Security Considerations

### Production Deployment
1. **Firebase Rules**: Implement proper Firestore security rules
2. **Authentication**: Consider adding user authentication
3. **HTTPS**: Always use HTTPS in production
4. **API Keys**: Keep Firebase config secure

### Recommended Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tardiness/{document} {
      allow read, write: if request.auth != null; // Requires authentication
    }
  }
}
```

## 📊 Data Structure

Each tardiness entry contains:
```javascript
{
    id: "unique-generated-id",
    fullName: "Student Name",
    grade: "11",
    strand: "STEM",
    section: "A",
    timestamp: "2024-01-15T10:30:00.000Z"
}
```

## 🚨 Troubleshooting

### Common Issues

1. **Firebase Connection Error**
   - Verify your Firebase configuration
   - Check internet connection
   - Ensure Firestore is enabled

2. **Offline Mode Not Working**
   - Check browser support for localStorage
   - Verify Firebase persistence is enabled

3. **Export Not Working**
   - Ensure all CDN libraries are loaded
   - Check browser console for errors

4. **Data Not Syncing**
   - Check Firebase security rules
   - Verify collection name matches code

### Browser Compatibility
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 📈 Performance Tips

1. **Large Datasets**: Consider pagination for datasets with 1000+ entries
2. **Offline Usage**: Data is cached locally for offline access
3. **Export Optimization**: Large exports may take time - be patient
4. **Real-time Updates**: Firebase provides real-time synchronization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the MIT License.

## 🆘 Support

For issues or questions:
1. Check the troubleshooting section
2. Review Firebase documentation
3. Check browser console for errors
4. Verify all dependencies are loaded

---

**Note**: This system is designed for educational institutions and should be used in compliance with local privacy and data protection regulations. 