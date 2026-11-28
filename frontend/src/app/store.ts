import { configureStore, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import type { AuthSession } from '../shared/api';

type AuthState =
  | { status: 'checking' }
  | { status: 'unavailable'; message: string }
  | { status: 'guest'; expired: boolean }
  | { status: 'signedIn'; session: AuthSession };

const auth = createSlice({
  name: 'auth',
  initialState: { status: 'checking' } as AuthState,
  reducers: {
    checking: (): AuthState => ({ status: 'checking' }),
    unavailable: (_, action: PayloadAction<string>): AuthState => ({ status: 'unavailable', message: action.payload }),
    signedIn: (_, action: PayloadAction<AuthSession>): AuthState => ({ status: 'signedIn', session: action.payload }),
    signedOut: (_, action: PayloadAction<boolean>): AuthState => ({ status: 'guest', expired: action.payload }),
  },
});

export const store = configureStore({ reducer: { auth: auth.reducer }, devTools: false });
export const authActions = auth.actions;
export const useAppDispatch = useDispatch.withTypes<typeof store.dispatch>();
export const useAppSelector = useSelector.withTypes<ReturnType<typeof store.getState>>();
