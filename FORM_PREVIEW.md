# Field Trip Form Interface Preview

## Visual Design Overview

### 🎨 Color Scheme
- **Background**: Purple gradient (soft purple to violet)
- **Form Container**: Clean white with rounded corners
- **Header**: Matching purple gradient with white text
- **Primary Actions**: Purple gradient buttons
- **Success**: Green (#198754)
- **Danger/Errors**: Red (#dc3545)
- **Warning**: Yellow (#ffc107)

---

## 📱 Layout & Structure

### Header Section
```
┌─────────────────────────────────────────────────────┐
│  🚌 Field Trip Application                          │
│  Owen D. Young Central School District              │
│  (Purple gradient background, white text)           │
└─────────────────────────────────────────────────────┘
```

### Form Sections (White background, organized with icons)

---

#### 1️⃣ Trip Information Section
**Icon**: 🗺️ Map

**Fields**:
- **Destination** (full width)
  - Text input
  - Required *
  - Max 200 characters

- **Date of Trip** (half width) | **Building** (half width)
  - Date picker | Dropdown
  - Required * | Required *
  - Must be future date | Options: HS, MS, IS, FL, ECC

---

#### 2️⃣ Contact Information Section
**Icon**: 👤 Person Circle

**Fields**:
- **Teacher/Adult in Charge** (full width)
  - Text input
  - Required *
  - Max 100 characters

- **Email Address** (half width) | **Phone Number** (half width)
  - Email input | Phone input
  - Required * | Required *
  - Validates email format | Auto-formats: (XXX) XXX-XXXX

---

#### 3️⃣ Group Details Section
**Icon**: 👥 People

**Fields (all one-third width, side by side)**:
- **Grade Level(s)**
  - Text input (e.g., "3rd Grade, 9-12")
  - Required *

- **Number of Students**
  - Number input
  - Required *
  - Minimum: 1

- **Number of Chaperones**
  - Number input
  - Required *
  - Minimum: 1

---

#### 4️⃣ Schedule Section
**Icon**: 🕐 Clock

**Fields (2x2 grid)**:
- **Time Leaving School** | **Time Arriving at Destination**
- **Time Leaving Destination** | **Time Arriving Back at School**

All:
- Time picker
- Required *
- Validates logical sequence (departure before arrival)

---

#### 5️⃣ Transportation Section
**Icon**: 🚚 Truck

**Fields**:
- **Mode of Transportation** (half width)
  - Dropdown
  - Required *
  - Options:
    - School Bus
    - Walking
    - Parent/Guardian Vehicles
    - Public Transportation
    - Other

- **Please Specify Transportation** (half width)
  - Text input
  - **Conditional**: Only shows if "Other" is selected
  - Required when visible *
  - Max 100 characters

---

#### 6️⃣ Educational Purpose Section
**Icon**: 📚 Book

**Fields**:
- **Purpose of Trip** (full width)
  - Textarea (3 rows)
  - Required *
  - Max 1000 characters
  - Character counter: "0/1000"
  - Placeholder: "Describe the educational purpose and learning objectives of this field trip"

- **Curriculum Connection** (full width)
  - Textarea (3 rows)
  - Required *
  - Max 500 characters
  - Character counter: "0/500"
  - Placeholder: "How does this trip connect to your curriculum standards and learning goals?"

---

#### 7️⃣ Cost Information Section
**Icon**: 💵 Currency Dollar

**Fields**:
- **Cost Per Student ($)** (half width) | **Funding Source** (half width)
  - Number input (decimals allowed) | Text input
  - Required * | Optional
  - Min: 0, Step: 0.01 | Max 200 characters
  - Placeholder: "0.00" | Placeholder: "e.g., General Fund, PTO, Grant"

---

### Footer Section (Light gray background)
```
┌─────────────────────────────────────────────────────┐
│  * Required fields                                   │
│                                                      │
│  [Save Draft]  [Submit Application]                 │
│  (outlined)    (purple gradient, solid)             │
└─────────────────────────────────────────────────────┘
```

---

## 🎯 Interactive Features

### Real-Time Validation
- **Valid fields**: Green border + checkmark
- **Invalid fields**: Red border + error message below
- **Validates on**: Blur (leaving field) and while typing (if already invalid)

### Visual Feedback
```
✓ Valid Field
  ┌─────────────────────────┐
  │ john@example.com        │  ← Green border
  └─────────────────────────┘

✗ Invalid Field
  ┌─────────────────────────┐
  │ john                    │  ← Red border
  └─────────────────────────┘
  ⚠ Please enter a valid email address  ← Red text
```

### Phone Auto-Format
As user types: `5551234567`
Becomes: `(555) 123-4567`

### Character Counters
```
Purpose of Trip *
┌─────────────────────────────────────┐
│ This trip will...                   │
└─────────────────────────────────────┘
Maximum 1000 characters. 17/1000  ← Live count
```

### Conditional Fields
When "Transportation" = "Other":
→ "Please Specify Transportation" field appears
→ Becomes required

Otherwise:
→ Field hidden
→ Not required

---

## 📤 Submission Flow

### 1. User clicks "Submit Application"
```
┌─────────────────────────────────────┐
│  ⟳ Submitting your application...   │
│                                     │
│  (Spinning loader)                  │
└─────────────────────────────────────┘
Overlay covers entire screen
```

### 2. Success Response
```
┌─────────────────────────────────────────────────┐
│ ✓ Success! Your field trip application has     │
│ been submitted. You will receive a confirmation│
│ email shortly. Submission #1234567890           │
└─────────────────────────────────────────────────┘
Green alert banner at top
Form resets
Scroll to top
Draft cleared
```

### 3. Error Response
```
┌─────────────────────────────────────────────────┐
│ ⚠ Error! Please correct the errors in the form │
│ before submitting.                              │
└─────────────────────────────────────────────────┘
Red alert banner at top
Invalid fields highlighted
```

---

## 💾 Draft Save Feature

### Save Draft Button
- Click "Save Draft" anytime
- Saves to browser's localStorage
- Success message appears

### Load Draft
On page load:
```
┌─────────────────────────────────────┐
│ A saved draft was found.            │
│ Would you like to load it?          │
│                                     │
│  [Cancel]  [Load Draft]             │
└─────────────────────────────────────┘
Browser confirm dialog
```

If Yes:
- All fields populate with saved data
- Blue info banner: "Previous draft loaded"

---

## 📱 Mobile Responsive

### Desktop (> 768px)
- Two-column layout where applicable
- Form max-width for readability
- Side-by-side buttons

### Mobile (< 768px)
- Single-column layout
- Full-width fields
- Stacked buttons
- Larger touch targets
- Optimized font sizes

---

## 🎨 Design Elements

### Section Headers
```
🗺️ Trip Information
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Purple text with purple underline
Icon on left
```

### Buttons
**Submit Button**:
- Purple gradient background
- White text
- Hover: Lifts up slightly with shadow
- Icon: Send/paper plane

**Save Draft Button**:
- White background
- Purple border
- Purple text
- Hover: Fills with purple gradient

### Form Fields
- Clean, rounded borders
- Proper spacing
- Labels above inputs
- Help text below in gray
- Placeholders for guidance

---

## ✨ User Experience Highlights

1. **Clear organization** - Logical sections with icons
2. **Visual feedback** - Immediate validation
3. **Helpful hints** - Placeholders and help text
4. **Error prevention** - Client-side validation before submit
5. **Save progress** - Draft functionality
6. **Professional look** - Modern design matches district branding
7. **Accessibility** - Proper labels, ARIA attributes
8. **Mobile-friendly** - Works on all devices
9. **Fast** - No page reloads
10. **Intuitive** - Follows web best practices

---

## 🔍 Validation Examples

### Date Validation
- Must be in future
- "Trip date must be in the future" if past date selected

### Time Sequence
- Leave school < Arrive destination
- Arrive destination < Leave destination
- Leave destination < Arrive school
- Shows specific error: "Arrival time must be after departure from school"

### Email Validation
- Must match email pattern
- "Please enter a valid email address"

### Phone Validation
- Must be 10 digits
- "Please enter a valid 10-digit phone number"
- Auto-formats as typed

### Required Fields
- Can't be empty
- "This field is required"

---

This modern interface replaces your old Materialize form with a cleaner, more professional Bootstrap 5 design while maintaining all the same questions and adding better validation and user experience features!
