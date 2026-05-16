# Post-Login User Flow

This flowchart is based on the current login, route, and role-protection logic in the frontend app.

```mermaid
flowchart TD
    A[User enters username/email and password] --> B[Click Login]
    B --> C[POST /api/users/token/]

    C -->|Login failed| D[Show error message on Login page]
    D --> A

    C -->|Access token returned| E[Save access and refresh tokens in localStorage]
    E --> F[GET /api/users/me/]
    F --> G[Save role and profile_complete in localStorage]

    G --> H{User role?}

    H -->|Student| I[Navigate to /student/dashboard]
    H -->|Instructor| J[Navigate to /instructor-dashboard]
    H -->|Admin| K[Navigate to /admin/dashboard]
    H -->|Unknown role| L[Show Invalid role error]

    I --> M[ProtectedRoute checks token and role]
    M -->|Valid| N[Redirect index to /student/dashboard/home]
    M -->|Missing, expired, invalid, or wrong role| Z[Redirect to /login]

    N --> N1[Student Home]
    N --> N2[My Courses]
    N --> N3[Course Details]
    N --> N4[Lessons]
    N --> N5[Take Exam]
    N --> N6[Review Exam]
    N --> N7[Assignments]
    N --> N8[Grades]
    N --> N9[Profile]
    N --> N10[Settings]

    J --> O[ProtectedRoute checks token and role]
    O -->|Valid| P[Open Instructor Dashboard Home]
    O -->|Missing, expired, invalid, or wrong role| Z

    P --> P1[Dashboard]
    P --> P2[Courses]
    P --> P3[Analytics]
    P --> P4[Students]
    P --> P5[Submissions]
    P --> P6[Notifications]
    P --> P7[Profile]
    P --> P8[Settings]
    P2 --> P9[Course Details]
    P9 --> P10[Lessons and Modules]
    P9 --> P11[Classwork, Assignments, Projects, Materials]
    P9 --> P12[Exam Preview and Analytics]

    K --> Q[ProtectedRoute checks token and role]
    Q -->|Valid| R[Open Admin Dashboard]
    Q -->|Missing, expired, invalid, or wrong role| Z

    R --> R1[Overview]
    R --> R2[All Users]
    R --> R3[Pending Instructor Approvals]
    R --> R4[AI Analytics and System Progress]
    R --> R5[Settings]
    R --> R6[Logs]

    N2 --> S[Optional: Open shared Meetings page]
    P2 --> S
    S --> T[ProtectedRoute allows student or instructor]
    T -->|Invalid session| Z
```

## Notes

- Failed login keeps the user on the login page and shows an error.
- Instructor accounts can also be blocked by approval or email-verification checks before access is granted.
- After login, every protected area validates the JWT token again before showing the page.
