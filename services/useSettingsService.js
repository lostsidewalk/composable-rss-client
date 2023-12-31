import { ref, reactive, readonly } from 'vue';
import { useRuntimeConfig } from 'nuxt/app';
import axios from "axios";

export function useSettingsService(props) {
  const {
    handleServerError,
    setLastServerMessage
  } = props.notification;

  const settingsIsLoading = ref(false);
  const account = reactive({});

  const config = useRuntimeConfig();
  let comprssApiUrl = config.public.comprssApiUrl;
  const settingsUrl = comprssApiUrl + '/settings';
  const exportUrl = comprssApiUrl + '/export';
  const deregisterUrl = comprssApiUrl + '/deregister';
  const emailApiKeyUrl = comprssApiUrl + '/send_key';

  const auth = props.auth;

  function openSettings() {
    settingsIsLoading.value = true;

    auth.getTokenSilently().then((token) => {
      const source = axios.CancelToken.source();

      const requestOptions = {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        cancelToken: source.token
      };

      const timeoutId = setTimeout(() => source.cancel('Request timeout'), 15000);

      axios.get(settingsUrl, requestOptions)
        .then((response) => {
          const isJson = isJsonContent(response.headers);
          if (response.status === 200) {
            return isJson ? response.data : {};
          } else {
            if (isJson) {
              throw new Error(response.data.message + (response.data.details ? (': ' + response.data.details) : ''));
            } else {
              throw new Error(response.data);
            }
          }
        })
        .then((data) => {
          Object.keys(account).forEach((key) => {
            delete account[key];
          });
          Object.assign(account, {
            username: data.username,
            emailAddress: data.emailAddress,
            authProvider: data.authProvider,
            authProviderProfileImgUrl: data.authProviderProfileImgUrl,
            authProviderUsername: data.authProviderUsername,
            frameworkConfig: data.frameworkConfig,
            apiKey: data.apiKey,
          });
        })
        .catch((error) => {
          handleServerError(error);
        })
        .finally(() => {
          clearTimeout(timeoutId);
          settingsIsLoading.value = false;
        });
    }).catch((error) => {
      handleServerError(error);
      settingsIsLoading.value = false;
    });
  }

  function updateNotificationPreferences(updateNotificationRequest) {
    const enableAccountAlerts = updateNotificationRequest.enableAccountAlerts;

    const newSettings = {
      frameworkConfig: {
        notifications: {
          accountAlerts: enableAccountAlerts,
        }
      }
    };

    settingsIsLoading.value = true;

    auth.getTokenSilently().then((token) => {
      const source = axios.CancelToken.source();

      const requestOptions = {
        method: 'PUT',
        url: settingsUrl,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        data: newSettings,
        cancelToken: source.token
      };

      const timeoutId = setTimeout(() => source.cancel('Request timeout'), 15000);

      axios(requestOptions).then((response) => {
        if (response.status === 200) {
          return;
        } else {
          if (isJsonContent(response.headers)) {
            throw new Error(response.data.message + (response.data.details ? (': ' + response.data.details) : ''));
          } else {
            throw new Error(response.data);
          }
        }
      }).then(() => {
        if (newSettings.username) {
          account.username = newSettings.username;
        }
        if (newSettings.emailAddress) {
          account.emailAddress = newSettings.emailAddress;
        }
        if (newSettings.frameworkConfig) {
          if (!account.frameworkConfig) {
            account.frameworkConfig = {};
          }
          Object.assign(account.frameworkConfig, newSettings.frameworkConfig);
        }
        setLastServerMessage('settingsUpdated');
      }).catch((error) => {
        handleServerError(error);
      }).finally(() => {
        clearTimeout(timeoutId);
        settingsIsLoading.value = false;
      });
    }).catch((error) => {
      handleServerError(error);
      settingsIsLoading.value = false;
    });
  }

  function exportData() {
    settingsIsLoading.value = true;

    auth.getTokenSilently().then((token) => {
      const source = axios.CancelToken.source();

      const requestOptions = {
        method: 'GET',
        url: exportUrl,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        responseType: 'blob',
        cancelToken: source.token
      };

      const timeoutId = setTimeout(() => source.cancel('Request timeout'), 15000);

      axios(requestOptions)
        .then((response) => {
          if (response.status === 200) {
            return response.data;
          } else {
            throw new Error($t('unexpectedResponseStatus', { "statusCode": response.status }));
          }
        })
        .then((blob) => {
          const url = window.URL.createObjectURL(new Blob([blob]));
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = 'feedgears-opml-export.xml';
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          setLastServerMessage('opmlExportDownloaded');
        })
        .catch((error) => {
          handleServerError(error);
        })
        .finally(() => {
          clearTimeout(timeoutId);
          settingsIsLoading.value = false;
        });
    }).catch((error) => {
      handleServerError(error);
      settingsIsLoading.value = false;
    });
  }

  function finalizeDeactivation() {
    settingsIsLoading.value = true;

    auth.getTokenSilently().then((token) => {
      const source = axios.CancelToken.source();

      const requestOptions = {
        method: 'DELETE',
        url: deregisterUrl,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        cancelToken: source.token
      };

      const timeoutId = setTimeout(() => source.cancel('Request timeout'), 15000);

      axios(requestOptions)
        .then((response) => {
          if (response.status === 200) {
            return response.data;
          } else {
            throw new Error($t('unexpectedResponseStatus', { "statusCode": response.status }));
          }
        })
        .catch((error) => {
          handleServerError(error);
        })
        .finally(() => {
          clearTimeout(timeoutId);
          settingsIsLoading.value = false;
          auth.tearDownLoggedInSession();
        });
    }).catch((error) => {
      handleServerError(error);
      settingsIsLoading.value = false;
    });
  }

  function initPasswordReset() {
    settingsIsLoading.value = true;
    auth.pwResetWithSupplied(account.username, account.emailAddress)
      .then(() => {
        setLastServerMessage('checkEmailForFurther');
      })
      .catch((error) => {
        handleServerError(error);
      })
      .finally(() => {
        settingsIsLoading.value = false;
      });
  }

  function emailApiKey() {
    settingsIsLoading.value = true;

    auth.getTokenSilently().then((token) => {
      const source = axios.CancelToken.source();

      const requestOptions = {
        method: 'POST',
        url: emailApiKeyUrl,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        cancelToken: source.token
      };

      const timeoutId = setTimeout(() => source.cancel('Request timeout'), 15000);

      axios(requestOptions)
        .then((response) => {
          if (response.status === 200) {
            return; // response payload is ignored 
          } else {
            throw new Error($t('unexpectedResponseStatus', { "statusCode": response.status }));
          }
        })
        .then(() => {
          setLastServerMessage('checkEmailForFurther');
        })
        .catch((error) => {
          handleServerError(error);
        })
        .finally(() => {
          clearTimeout(timeoutId);
          settingsIsLoading.value = false;
        });
    }).catch((error) => {
      handleServerError(error);
      settingsIsLoading.value = false;
    });
  }

  function isJsonContent(headers) {
    const headerKeys = Object.keys(headers);
    for (let i = 0; i < headerKeys.length; i++) {
      let key = headerKeys[i];
      if (key.toLowerCase() === 'content-type') {
        let headerValue = headers[key];
        return 'application/json' === headerValue.toLowerCase();
      }
    }

    return false;
  }

  const roAccount = readonly(account);
  const roSettingsIsLoading = readonly(settingsIsLoading);

  return {
    roAccount,
    roSettingsIsLoading,
    openSettings,
    updateNotificationPreferences,
    exportData,
    finalizeDeactivation,
    initPasswordReset,
    emailApiKey,
  };
}
