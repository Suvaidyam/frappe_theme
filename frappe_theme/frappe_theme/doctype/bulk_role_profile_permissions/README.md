# Bulk Role Profile Permissions

## Overview
Yeh feature aapko ek DocType ke liye bulk mein permissions set karne ki suvidha deta hai. Aap system ke saare Role Profiles aur unke Roles ko ek saath load kar sakte hain aur unhe permissions de sakte hain.

## Features

### 1. **DocType Selection**
- Koi bhi DocType choose kar sakte hain jiske liye permissions set karne hain

### 2. **Auto-Load Role Profiles**
- "Load Role Profiles" button se automatically saare Role Profiles aur unke assigned Roles load ho jayenge
- Har Role Profile ke andar jo roles assign hain, wo sab dikhenge

### 3. **Bulk Permission Actions**
Aap bulk mein permissions set kar sakte hain:
- **Enable Read** - Sabko read permission
- **Enable Write** - Sabko write permission  
- **Enable Read & Write** - Dono permissions ek saath
- **Select All** - Saari permissions enable
- **Deselect All** - Saari permissions disable

### 4. **Quick Presets**
Ready-made permission templates:
- **Read Only** - Sirf read permission
- **Full Access** - Saari permissions
- **Report Only** - Read, Report, Export, Print
- **Data Entry** - Read, Write, Create, Report, Export, Print, Email

### 5. **Individual Control**
Har row mein aap individually bhi permissions set kar sakte hain:
- Select
- Read
- Write
- Create
- Delete
- Submit
- Cancel
- Amend
- Report
- Export
- Import
- Share
- Print
- Email

### 6. **Permission Levels**
- Level 0 se 9 tak permission levels set kar sakte hain
- Higher levels sirf Read aur Write permissions support karte hain

## How to Use

1. **DocType Select karein**
   - "DocType" field mein wo DocType select karein jiske liye permissions chahiye

2. **Role Profiles Load karein**
   - "Load Role Profiles" button click karein
   - Automatically saare Role Profiles aur unke Roles load ho jayenge

3. **Permissions Set karein**
   - Bulk Actions use karein ya individual rows edit karein
   - Quick Presets se ready-made templates apply karein

4. **Apply karein**
   - "Apply Permissions" button click karein
   - Confirm karein
   - Permissions create/update ho jayengi

## Technical Details

### DocTypes Created
1. **Bulk Role Profile Permissions** (Single DocType)
   - Main form jahan se sab control hota hai
   
2. **Bulk Role Profile Permissions Child** (Table)
   - Role Profile, Role aur permissions store karta hai

### Backend Methods
- `get_role_profiles_with_roles()` - Saare Role Profiles aur Roles fetch karta hai
- `apply_bulk_permissions()` - Permissions create/update karta hai

### Files Structure
```
bfs/bfs/doctype/
├── bulk_role_profile_permissions/
│   ├── __init__.py
│   ├── bulk_role_profile_permissions.json
│   ├── bulk_role_profile_permissions.py
│   └── bulk_role_profile_permissions.js
└── bulk_role_profile_permissions_child/
    ├── __init__.py
    ├── bulk_role_profile_permissions_child.json
    └── bulk_role_profile_permissions_child.py
```

## Example Use Case

Agar aapko "Project" DocType ke liye saare Role Profiles ko permissions deni hai:

1. DocType = "Project" select karein
2. "Load Role Profiles" click karein
3. "Full Access" preset apply karein (ya apni zarurat ke hisaab se customize karein)
4. "Apply Permissions" click karein

Done! Saare Role Profiles ke saare Roles ko Project DocType ki permissions mil gayi.

## Notes

- Yeh feature Custom DocPerm use karta hai
- Existing permissions update ho jayengi, naye create ho jayenge
- Cache automatically clear hoti hai permissions apply karne ke baad
- Sirf System Manager ko access hai is feature ka
