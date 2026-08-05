export interface ParsedApiError {
  status?: number;
  code?: string;
  message: string;
}

type ApiErrorResponseData = {
  code?: string;
  message?: string;
  error?: string | { description?: string };
};

type ApiLikeError = {
  response?: {
    status?: number;
    data?: ApiErrorResponseData;
  };
  message?: string;
};

export const parseApiError = (
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): ParsedApiError => {
  const e = (error || {}) as ApiLikeError;
  const status = e.response?.status;
  const data = e.response?.data || {};
  const code = data?.code;
  const message =
    data?.message ||
    (typeof data?.error === "object" ? data.error?.description : undefined) ||
    (typeof data?.error === "string" ? data.error : undefined) ||
    e?.message ||
    fallback;

  return { status, code, message };
};

export const handleApiErrorWithLimitAlert = (
  error: unknown,
  fallbackMessage: string,
  user: any,
  router: any,
  t?: (key: string) => string
): ParsedApiError => {
  const { status, code, message } = parseApiError(error, fallbackMessage);
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin' || user?.organization_role === 'admin';

  if (code === 'LIMIT_REACHED' || code === 'SUBSCRIPTION_LOCKED') {
    const cancelText = t ? t('upload.cancel') : 'Cancel';
    const upgradeText = code === 'SUBSCRIPTION_LOCKED'
      ? (t ? (t('upload.billing') || 'Billing') : 'Billing')
      : (t ? (t('upload.upgrade') || 'Upgrade') : 'Upgrade');
    
    const title = code === 'LIMIT_REACHED'
      ? (t ? (t('upload.limitReachedTitle') || 'Limit Reached') : 'Limit Reached')
      : (t ? (t('upload.subscriptionLocked') || 'Subscription Locked') : 'Subscription Locked');

    const { Alert } = require('react-native');
    Alert.alert(
      title,
      message,
      isAdmin
        ? [
            { text: cancelText, style: 'cancel' },
            { text: upgradeText, onPress: () => router.push('/subscription') }
          ]
        : [{ text: cancelText, style: 'cancel' }]
    );
  } else {
    const { Alert } = require('react-native');
    const title = t ? (t('upload.uploadFailed') || 'Error') : 'Error';
    Alert.alert(title, message);
  }

  return { status, code, message };
};
