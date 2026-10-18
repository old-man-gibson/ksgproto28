import type { KeyItemDef } from '../types';
import { prose } from '../text/prose';
import { KEY_ITEMS_TEXT } from '../text/keyitems.text';

export const KEY_ITEMS = prose<KeyItemDef>('KEY_ITEMS', KEY_ITEMS_TEXT, {
  toll_clerk_book: { id: 'toll_clerk_book', name: "A Clerk's Daybook", icon: '📖' },
  toll_office_key: { id: 'toll_office_key', name: 'Office Key', icon: '🗝️' },
  toll_stamp: { id: 'toll_stamp', name: 'Toll Stamp', icon: '📜' },
});
