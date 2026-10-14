import T from '@/src/i18n/T';

export default function EchoLoading() {
  return (
    <main className="echo-unavailable" data-p11-theme="echo" aria-busy="true">
      <p>PERMANENT ARCHIVE · READING CHAIN</p>
      <h1><T k="loading.echoTitle" /></h1>
      <p><T k="loading.echoDescription" /></p>
    </main>
  );
}
