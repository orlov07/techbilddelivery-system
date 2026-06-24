import { ToastContainer } from './components/ui/Toast';
import { DateRangeProvider } from './contexts/DateRangeContext';
import { AppRouter } from './router';

export default function App() {
  return (
    <DateRangeProvider>
      <AppRouter />
      <ToastContainer />
    </DateRangeProvider>
  );
}
