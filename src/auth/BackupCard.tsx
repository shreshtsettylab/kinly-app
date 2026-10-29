import { useEffect, useState } from 'react';
import { CloudUpload } from 'lucide-react';
import { friendlyAuthError } from './authErrors';
import { useAuth } from './authState';
import { accountCounts, BackupStepError, buildBackupRows, describeCounts, localCounts, uploadBackup, type BackupRows, type Counts } from './cloudBackup';
import { supabase } from './supabaseClient';

type Stage = 'idle' | 'review' | 'working' | 'done' | 'error';

// Settings card for signed-in users: an explicit, one-way copy of this browser's data into
// their private account tables. Nothing uploads until they review and confirm.
export function BackupCard({ onExport }: { onExport: () => string }) {
  const auth = useAuth();
  const [stage, setStage] = useState<Stage>('idle');
  const [rows, setRows] = useState<BackupRows | null>(null);
  const [inAccount, setInAccount] = useState<Counts | null>(null);
  const [message, setMessage] = useState('');
  const userId = auth.user?.id;

  useEffect(() => {
    if (!supabase || !userId) return;
    accountCounts(supabase).then(setInAccount).catch(() => setInAccount(null));
  }, [userId]);

  if (auth.status !== 'signedIn' || !supabase || !userId) return null;
  const client = supabase;

  const review = () => { setRows(buildBackupRows(userId)); setMessage(''); setStage('review'); };

  const run = async () => {
    if (!rows) return;
    setStage('working');
    // A local backup file comes first, so there is always a copy outside the browser.
    onExport();
    try {
      await uploadBackup(client, rows);
      const after = await accountCounts(client);
      setInAccount(after);
      setMessage(`Copied ${describeCounts(localCounts(rows))}${rows.profile ? ', plus your profile' : ''}.`);
      setStage('done');
    } catch (failure) {
      const step = failure instanceof BackupStepError ? failure.message : 'Couldn’t finish the backup.';
      const cause = failure instanceof BackupStepError ? failure.original : failure;
      setMessage(`${step} ${friendlyAuthError(cause) === 'Something went wrong. Please try again.' ? 'Please try again.' : friendlyAuthError(cause)} Nothing in this browser was changed, and anything already copied is safe to copy again.`);
      setStage('error');
    }
  };

  const local = rows ? localCounts(rows) : null;
  const nothingToCopy = local !== null && !rows?.profile && Object.values(local).every((count) => count === 0);

  return <section className="content-card settings-ai settings-backup">
    <div className="reflection-icon"><CloudUpload size={19} /></div>
    <div className="settings-ai-copy">
      <span className="card-kicker">BACK UP TO YOUR ACCOUNT</span>
      <h2>Keep a copy in your account</h2>
      {stage === 'idle' && <p>Copy your people, plans, goals, reflections and check-ins from this browser into your private account. Your browser data stays exactly as it is. {inAccount && <>Your account holds <b>{describeCounts(inAccount)}</b>.</>}</p>}
      {stage === 'review' && local && <>
        {nothingToCopy ? <p>There’s nothing in this browser to copy yet.</p> : <p>Kinly will first download a backup file, then copy <b>{describeCounts(local)}</b>{rows?.profile ? ' and your profile' : ''} to your account. Items with the same name in your account are updated, not duplicated.</p>}
        {rows && rows.skipped > 0 && <p className="settings-backup-note">{rows.skipped} incomplete {rows.skipped === 1 ? 'item' : 'items'} (missing a name, title or date) will be left out.</p>}
      </>}
      {stage === 'working' && <p role="status">Copying to your account…</p>}
      {stage === 'done' && <p role="status" className="settings-backup-ok">{message} Your account now holds <b>{inAccount ? describeCounts(inAccount) : 'your data'}</b>.</p>}
      {stage === 'error' && <p role="alert" className="settings-backup-error">{message}</p>}
      <p className="settings-ai-status">Copies are private to you. Restoring from your account to another device is coming later.</p>
    </div>
    <div className="settings-account-actions">
      {(stage === 'idle' || stage === 'done' || stage === 'error') && <button className={stage === 'idle' ? 'primary-button' : 'quiet-button'} onClick={review}>{stage === 'idle' ? 'Back up my data' : 'Back up again'}</button>}
      {stage === 'review' && <>{!nothingToCopy && <button className="primary-button" onClick={run}>Download backup &amp; copy</button>}<button className="quiet-button" onClick={() => setStage('idle')}>Cancel</button></>}
      {stage === 'working' && <button className="primary-button" disabled>Copying…</button>}
    </div>
  </section>;
}
