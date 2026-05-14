// ============================================================================
// GOOGLE WORKSPACE INTEGRATION
// ============================================================================
// Functions to import users and data from Google Workspace

/**
 * Get access token from Firebase auth user
 */
export function getAccessToken(firebaseUser) {
  // Firebase stores the Google access token
  return firebaseUser?.stsTokenManager?.accessToken || null;
}

/**
 * Import users from Google Workspace Admin Directory
 */
export async function importGoogleWorkspaceUsers(accessToken) {
  try {
    const response = await fetch(
      'https://admin.googleapis.com/admin/directory/v1/users?domain=primary&maxResults=500',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        }
      }
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Transform Google users to AccessGuard format
    const users = (data.users || []).map(user => ({
      id: user.id,
      name: user.name.fullName,
      email: user.primaryEmail,
      status: user.suspended ? 'offboarded' : 'active',
      department: user.orgUnitPath?.split('/').pop() || 'general',
      role: user.isAdmin ? 'admin' : 'user',
      google_user_id: user.id,
      last_login: user.lastLoginTime,
      created_at: user.creationTime,
      imported_from: 'google_workspace',
      imported_at: new Date().toISOString(),
    }));

    return { users, error: null };
  } catch (error) {
    console.error('Error importing Google Workspace users:', error);
    return { users: [], error: error.message };
  }
}

/**
 * Scan Gmail for SaaS invoices (Phase 2)
 */
export async function scanGmailForInvoices(accessToken) {
  try {
    // Search for common SaaS invoice patterns
    const queries = [
      'subject:(invoice OR receipt OR bill) from:(stripe OR paypal)',
      'subject:invoice has:attachment',
      'subject:"your invoice"',
    ];

    const invoices = [];

    for (const q of queries) {
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=50`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.messages) {
          invoices.push(...data.messages);
        }
      }
    }

    return { invoices, error: null };
  } catch (error) {
    console.error('Error scanning Gmail:', error);
    return { invoices: [], error: error.message };
  }
}

/**
 * Check if user has granted necessary permissions
 */
export function hasWorkspacePermissions(firebaseUser) {
  // Check if we have an access token with the right scopes
  const token = getAccessToken(firebaseUser);
  return token !== null;
}
