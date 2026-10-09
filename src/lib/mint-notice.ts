/** 收藏/铸造被服务端接受后，通知右上角提示（DraftSavedToast）与 /me 刷新；不等链上确认。 */
export const MINT_RECORDED_EVENT = 'pond:mint-recorded';
export function announceMintRecorded() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(MINT_RECORDED_EVENT));
}
