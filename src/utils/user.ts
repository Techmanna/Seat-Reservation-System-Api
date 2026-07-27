/**
 * Utility functions for user-related data processing
 */

export interface ParsedName {
  firstName: string;
  lastName: string;
  fullName: string;
}

/**
 * Splits a full name into first and last name components.
 * Defaults to 'Subscriber' and 'Member' if empty.
 */
export const parseUserName = (fullName?: string): ParsedName => {
  const name = fullName?.trim() || 'Subscriber';
  const nameParts = name.split(/\s+/);
  
  const firstName = nameParts[0] || 'Subscriber';
  const lastName = nameParts.slice(1).join(' ') || 'Member';
  
  return {
    firstName,
    lastName,
    fullName: name
  };
};
