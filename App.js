import RootNavigator from './navigation/RootNavigator';
import ErrorBoundary from './components/ErrorBoundary';
import { AppDialogHost } from './components/AppDialog';

export default function App() {
  return (
    <ErrorBoundary>
      <RootNavigator />
      <AppDialogHost />
    </ErrorBoundary>
  );
}
