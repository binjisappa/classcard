import React, { useState, useEffect, useCallback } from 'react';
import PokeCard from '../components/PokeCard';
import BuiltCard from '../components/BuiltCard';
import { Auth } from '../lib/auth';
import { Dashboard } from '../lib/dashboard';
import { AI } from '../lib/ai';
import { sb } from '../lib/supabase';
import type { Session } from '../lib/auth';
import type { Student, Card } from '../lib/supabase';

type TabKey = 'generate' | 'build' | 'weekly' | 'cards' | 'students' | 'settings';
const RARITY_ICONS: Record<string, string> = { common: '⭐', silver: '✦', 'gold-rare': '★', prismatic: '✦✦' };

const TABS: { key: TabKey; label: string }[] = [
  { key: 'generate', label: '✦ Generate Card' },
  { key: 'build', label: '✦ Build a Card' },
  { key: 'weekly', label: '📋 Weekly Project' },
  { key: 'cards', label: 'My Cards' },
  { key: 'students', label: 'Students' },
  { key: 'settings', label: 'Settings' },
];

function TeacherPage({ session, onSignOut }: { session: NonNullable<Session>; onSignOut: () => void }) {
  const [tab, setTab] = useState<TabKey>('generate');
  const [students, setStudents] = useState<Student[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [rarity, setRarity] = useState<string>('common');
  const [achievement, setAchievement] = useState('');
  const [characterType, setCharacterType] = useState('');
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState<'default' | 'working' | 'error' | 'done'>('default');
  const [generatedCard, setGeneratedCard] = useState<Partial<Card> & { image_url: string; students?: { name: string } } | null>(null);
  const [savedBanner, setSavedBanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const [emailKey, setEmailKey] = useState('');
  const [emailService, setEmailService] = useState('');
  const [emailTemplate, setEmailTemplate] = useState('');
  const [modal, setModal] = useState<{ type: string; data?: any } | null>(null);
  const [modalError, setModalError] = useState('');
  const [detailCard, setDetailCard] = useState<Card | null>(null);
  const [filterStudent, setFilterStudent] = useState<string | null>(null);

  // Weekly Project state
  const [weeklyProject, setWeeklyProject] = useState<any>(null);
  const [weeklyTask, setWeeklyTask] = useState('');
  const [weeklyTitle, setWeeklyTitle] = useState('');
  const [weeklyCharHint, setWeeklyCharHint] = useState('');
  const [weeklyGenerating, setWeeklyGenerating] = useState(false);
  const [weeklyCard, setWeeklyCard] = useState<Partial<Card> & { image_url: string } | null>(null);
  const [weeklyStatus, setWeeklyStatus] = useState('');
  const [weeklyStatusType, setWeeklyStatusType] = useState<'default'|'working'|'error'|'done'>('default');
  const [awardModal, setAwardModal] = useState(false);
  const [awardSelections, setAwardSelections] = useState<Record<string, 'common'|'silver'|'gold-rare'>>({});
  const [awardError, setAwardError] = useState('');
  const [awarding, setAwarding] = useState(false);
  const [weeklyEndDate, setWeeklyEndDate] = useState('');
  const [weeklyView, setWeeklyView] = useState<'project'|'submissions'>('project');
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);

  // Build a Card state
  const [buildStudent, setBuildStudent] = useState<Student | null>(null);
  const [buildImage, setBuildImage] = useState<string | null>(null);
  const [buildScale, setBuildScale] = useState(1);
  const [buildRotation, setBuildRotation] = useState(0);
  const [buildPosition, setBuildPosition] = useState({ x: 0, y: 0 });
  const [buildIsDragging, setBuildIsDragging] = useState(false);
  const [buildDragStart, setBuildDragStart] = useState({ clientX: 0, clientY: 0, startX: 0, startY: 0 });
  const [buildSaving, setBuildSaving] = useState(false);
  const [buildSaved, setBuildSaved] = useState(false);
  const [buildCroppedImage, setBuildCroppedImage] = useState<string | null>(null);
  const [buildCard, setBuildCard] = useState({
    name: '',
    rarity: 'common' as string,
    type: 'fire' as string,
    description: '',
    attack: 75,
    defense: 60,
    speed: 50,
  });

  const loadData = useCallback(async () => {
    try {
      const [sList, cListRaw] = await Promise.all([
        Dashboard.getMyStudents(session.user.id),
        Dashboard.getMyCards(session.user.id),
      ]);
      // Hide the auto-granted Aura-Bot welcome card from the teacher's My Cards view
      const cList = cListRaw.filter((c: any) => c.card_name !== Dashboard.WELCOME_CARD_NAME);
      // Load current week's project if one exists
      try {
        const { data: wp } = await sb.from('weekly_projects')
          .select('*')
          .eq('teacher_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (wp) {
          setWeeklyProject(wp);
          setWeeklyTitle(wp.title || '');
          setWeeklyTask(wp.task || '');
          setWeeklyCharHint(wp.char_hint || '');
          if (wp.card_data) setWeeklyCard(wp.card_data);
        }
      } catch { /* no weekly_projects table yet — ignore */ }
      setStudents(sList);
      setCards(cList);
      setGeminiKey(AI.getGeminiKey());
      // Load email settings from localStorage
      setEmailKey(localStorage.getItem('classcard_email_key') || '');
      setEmailService(localStorage.getItem('classcard_email_service') || '');
      setEmailTemplate(localStorage.getItem('classcard_email_template') || '');
    } catch (err: any) {
      setStatus(err.message);
      setStatusType('error');
    }
  }, [session.user.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const setWorking = (msg: string) => { setStatus(msg); setStatusType('working'); };
  const setDone = (msg: string) => { setStatus(msg); setStatusType('done'); setTimeout(() => setStatus(''), 2800); };
  const setErr = (msg: string) => { setStatus(msg); setStatusType('error'); };

  // Generate card
  const handleGenerate = async () => {
    if (!selectedStudent) { setErr('Select a student.'); return; }
    if (!achievement.trim()) { setErr('Describe the achievement.'); return; }
    setLoading(true);
    setGeneratedCard(null);
    setSavedBanner(false);
    setWorking('Generating card with Gemini…');

    try {
      const data = await AI.generateCardData(selectedStudent.name, achievement, characterType, rarity);
      setWorking('Generating character image…');

      const imgUrl = AI.generateImageUrl(data.imagePrompt || data.cardName);
      // Preload image
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = imgUrl;
        setTimeout(resolve, 2000);
      });

      const cardData: Partial<Card> & { image_url: string; students?: { name: string } } = {
        card_name: data.cardName,
        hp: data.hp,
        type: data.type,
        description: data.description,
        stat1_name: data.stat1Name,
        stat1_val: data.stat1Val,
        stat2_name: data.stat2Name,
        stat2_val: data.stat2Val,
        stat3_name: data.stat3Name,
        stat3_val: data.stat3Val,
        move1_name: data.move1Name,
        move1_dmg: data.move1Dmg,
        move2_name: data.move2Name,
        move2_dmg: data.move2Dmg,
        rarity: rarity as any,
        image_url: imgUrl,
        students: { name: selectedStudent.name },
        student_id: selectedStudent.id,
        teacher_id: session.user.id,
      };

      setGeneratedCard(cardData);
      setDone('Card generated! Save it to the student\'s collection.');
    } catch (err: any) {
      setErr(err.message || 'Generation failed');
    }
    setLoading(false);
  };

  const handleSaveCard = async () => {
    if (!generatedCard || !selectedStudent) return;
    try {
      const toSave = { ...generatedCard };
      delete (toSave as any).students;
      const saved = await Dashboard.saveCard(toSave as any);
      setCards(prev => [saved, ...prev]);
      setSavedBanner(true);
      setDone('Card saved!');
      setGeneratedCard(null);
    } catch (err: any) {
      setErr(err.message);
    }
  };

  const handleSaveKey = () => {
    AI.setGeminiKey(geminiKey);
    setDone('API key saved');
  };

  const handleSaveEmail = () => {
    localStorage.setItem('classcard_email_key', emailKey);
    localStorage.setItem('classcard_email_service', emailService);
    localStorage.setItem('classcard_email_template', emailTemplate);
    setDone('Email settings saved');
  };

  // Filtered cards
  const displayCards = filterStudent
    ? cards.filter(c => c.student_id === filterStudent)
    : cards;

  return (
    <div className="parchment-page font-body min-h-screen">
      {/* Header */}
      <header
        className="sticky top-0 z-[100]"
        style={{ background: 'linear-gradient(180deg, rgba(90,40,10,0.18), rgba(90,40,10,0.08))', borderBottom: '2px solid rgba(90,50,10,0.2)', backdropFilter: 'blur(4px)' }}
      >
        <div className="flex items-center justify-between mx-auto" style={{ maxWidth: 1200, padding: '0.9rem 2rem' }}>
          <span className="logo-gradient--parchment" style={{ fontSize: '1.3rem' }}>✦ ClassCard ✦</span>
          <div className="flex items-center gap-3">
            <span className="text-xs px-3 py-1 rounded-[20px]" style={{ background: 'rgba(90,40,10,0.15)', border: '1px solid rgba(90,40,10,0.25)', color: '#5a2e0a' }}>
              {session.user.email}
            </span>
            <span className="text-xs px-3 py-1 rounded-[20px] font-extrabold tracking-widest uppercase" style={{ background: 'rgba(200,160,0,0.2)', color: '#ffe080', border: '1px solid rgba(200,160,0,0.4)' }}>
              Teacher
            </span>
            <button onClick={onSignOut} className="btn-outline" style={{ borderColor: 'rgba(90,40,10,0.35)', color: '#5a2e0a' }}>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="mx-auto" style={{ maxWidth: 1200, padding: '0 2rem' }}>
        <div className="tab-bar tab-bar--parchment">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`tab-btn tab-btn--parchment ${tab === t.key ? 'active' : ''}`}
              onClick={() => { setTab(t.key); setFilterStudent(null); }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Generate Card Tab */}
        {tab === 'generate' && (
          <div className="grid gap-6" style={{ gridTemplateColumns: 'minmax(300px, 380px) 1fr' }}>
            {/* Left Column */}
            <div>
              {/* Student Selection */}
              <div className="p-6 rounded-xs" style={{ background: 'rgba(255,248,222,0.65)', border: '1px solid rgba(90,50,10,0.18)', boxShadow: '2px 3px 12px rgba(0,0,0,0.09), inset 0 1px 0 rgba(255,255,255,0.5)' }}>
                <h3 className="form-label form-label--parchment flex items-center gap-2 mb-4">
                  <span className="inline-block w-1 h-4 rounded" style={{ background: 'var(--gold)' }} />
                  Select Student
                </h3>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {students.length === 0 && (
                    <span className="text-xs italic" style={{ color: '#9a7040' }}>No students yet — add one in the Students tab</span>
                  )}
                  {students.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { setSelectedStudent(s); setSavedBanner(false); }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[20px] text-xs cursor-pointer transition-all border"
                      style={{
                        background: selectedStudent?.id === s.id ? 'rgba(200,160,0,0.12)' : 'rgba(255,248,222,0.5)',
                        borderColor: selectedStudent?.id === s.id ? '#c8a000' : 'rgba(90,50,10,0.18)',
                        color: selectedStudent?.id === s.id ? '#8b6a00' : '#7a5a40',
                      }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card Details */}
              <div className="p-6 rounded-xs mt-5" style={{ background: 'rgba(255,248,222,0.65)', border: '1px solid rgba(90,50,10,0.18)', boxShadow: '2px 3px 12px rgba(0,0,0,0.09), inset 0 1px 0 rgba(255,255,255,0.5)' }}>
                <h3 className="form-label form-label--parchment flex items-center gap-2 mb-4">
                  <span className="inline-block w-1 h-4 rounded" style={{ background: 'var(--gold)' }} />
                  Card Details
                </h3>

                {/* Rarity */}
                <label className="form-label form-label--parchment">Rarity</label>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { key: 'common', icon: '⭐', label: 'Common', cls: 'r-common' },
                    { key: 'silver', icon: '✦', label: 'Silver', cls: 'r-silver' },
                    { key: 'gold-rare', icon: '★', label: 'Gold', cls: 'r-gold' },
                    { key: 'prismatic', icon: '✦✦', label: 'Prism', cls: 'r-prismatic' },
                  ].map(r => (
                    <button
                      key={r.key}
                      className={`rarity-btn ${r.cls} ${rarity === r.key ? 'active' : ''}`}
                      onClick={() => setRarity(r.key)}
                    >
                      <span className="r-icon">{r.icon}</span>
                      <span>{r.label}</span>
                    </button>
                  ))}
                </div>

                <div className="mb-4">
                  <label className="form-label form-label--parchment">What did the student do well?</label>
                  <textarea
                    className="form-input form-input--parchment resize-none"
                    style={{ minHeight: 75 }}
                    placeholder="e.g. Solved every maths problem today without giving up, and helped classmates understand fractions."
                    value={achievement}
                    onChange={e => setAchievement(e.target.value)}
                  />
                </div>

                <div className="mb-4">
                  <label className="form-label form-label--parchment">
                    Character Type <span className="text-xs" style={{ color: '#9a7040' }}>(optional)</span>
                  </label>
                  <input
                    type="text" className="form-input form-input--parchment"
                    placeholder="e.g. fire dragon, ocean wizard, forest fox…"
                    value={characterType}
                    onChange={e => setCharacterType(e.target.value)}
                  />
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="btn-gold w-full"
                  style={{ fontFamily: "'Cinzel', serif", fontSize: '0.95rem', letterSpacing: '0.08em' }}
                >
                  {loading ? 'Generating…' : '✦ Generate Card ✦'}
                </button>

                {status && (
                  <div className={`status-bar ${statusType} mt-3`}>
                    {status}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Preview */}
            <div className="flex flex-col items-center gap-4" style={{ minHeight: 400 }}>
              {!generatedCard ? (
                <div
                  className="flex flex-col items-center justify-center"
                  style={{ width: 260, height: 375, borderRadius: 18, border: '2px dashed rgba(200,160,0,0.2)' }}
                >
                  <span className="text-4xl mb-3" style={{ opacity: 0.25 }}>🃏</span>
                  <span className="text-sm italic" style={{ color: '#9a7040' }}>Card preview appears here</span>
                </div>
              ) : (
                <>
                  <PokeCard card={generatedCard as Card} showShimmerBtn />
                  {savedBanner ? (
                    <div className="alert-success w-full text-center">
                      Card saved to student's collection!
                    </div>
                  ) : (
                    <div className="flex gap-3 flex-wrap justify-center">
                      <button onClick={handleGenerate} className="btn-outline btn-sm" style={{ borderColor: 'rgba(200,160,0,0.35)', color: '#c07800' }}>
                        ↺ Regenerate
                      </button>
                      <button onClick={handleSaveCard} className="btn-gold btn-sm">
                        💾 Save to Student
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}



        {/* ── Weekly Project Tab ─────────────────────────────── */}
        {tab === 'weekly' && (
          <WeeklyProjectTab
            students={students}
            session={session}
            weeklyTask={weeklyTask}
            setWeeklyTask={setWeeklyTask}
            weeklyTitle={weeklyTitle}
            setWeeklyTitle={setWeeklyTitle}
            weeklyCharHint={weeklyCharHint}
            setWeeklyCharHint={setWeeklyCharHint}
            weeklyGenerating={weeklyGenerating}
            setWeeklyGenerating={setWeeklyGenerating}
            weeklyCard={weeklyCard}
            setWeeklyCard={setWeeklyCard}
            weeklyProject={weeklyProject}
            setWeeklyProject={setWeeklyProject}
            weeklyStatus={weeklyStatus}
            setWeeklyStatus={setWeeklyStatus}
            weeklyStatusType={weeklyStatusType}
            setWeeklyStatusType={setWeeklyStatusType}
            awardModal={awardModal}
            setAwardModal={setAwardModal}
            awardSelections={awardSelections}
            setAwardSelections={setAwardSelections}
            awardError={awardError}
            setAwardError={setAwardError}
            awarding={awarding}
            setAwarding={setAwarding}
            onRefresh={loadData}
            weeklyEndDate={weeklyEndDate}
            setWeeklyEndDate={setWeeklyEndDate}
            weeklyView={weeklyView}
            setWeeklyView={setWeeklyView}
            submissions={submissions}
            setSubmissions={setSubmissions}
            submissionsLoading={submissionsLoading}
            setSubmissionsLoading={setSubmissionsLoading}
          />
        )}

        {/* Build a Card Tab */}
        {tab === 'build' && (
          <BuildCardTab
            students={students}
            buildStudent={buildStudent}
            setBuildStudent={setBuildStudent}
            buildImage={buildImage}
            setBuildImage={setBuildImage}
            buildCroppedImage={buildCroppedImage}
            setBuildCroppedImage={setBuildCroppedImage}
            buildScale={buildScale}
            setBuildScale={setBuildScale}
            buildRotation={buildRotation}
            setBuildRotation={setBuildRotation}
            buildPosition={buildPosition}
            setBuildPosition={setBuildPosition}
            buildIsDragging={buildIsDragging}
            setBuildIsDragging={setBuildIsDragging}
            buildDragStart={buildDragStart}
            setBuildDragStart={setBuildDragStart}
            buildCard={buildCard}
            setBuildCard={setBuildCard}
            buildSaving={buildSaving}
            setBuildSaving={setBuildSaving}
            buildSaved={buildSaved}
            setBuildSaved={setBuildSaved}
            session={session}
            onSaved={() => loadData()}
          />
        )}
        {/* My Cards Tab */}
        {tab === 'cards' && (
          <div>
            {filterStudent && (
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm" style={{ color: '#7a5a40' }}>
                  Showing cards for: <strong>{students.find(s => s.id === filterStudent)?.name}</strong>
                </span>
                <button onClick={() => setFilterStudent(null)} className="btn-outline btn-sm" style={{ borderColor: 'rgba(90,40,10,0.25)', color: '#7a5a40' }}>
                  Show All
                </button>
              </div>
            )}
            <h2 className="font-display font-bold text-xs uppercase tracking-[0.15em] mb-4" style={{ color: '#c8a000' }}>
              Cards You've Created
            </h2>
            {displayCards.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-5xl block mb-4" style={{ opacity: 0.25 }}>🃏</span>
                <span className="text-sm italic" style={{ color: '#9a7040' }}>No cards yet.</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-8" style={{ padding: '1rem 0' }}>
                {displayCards.map(c => (
                  <div key={c.id} className="relative">
                    {c.card_source === 'built' ? <BuiltCard card={c} onClick={() => setDetailCard(c)} /> : <PokeCard card={c} showShimmerBtn onClick={() => setDetailCard(c)} />}
                    <div className="flex gap-1.5 justify-center mt-2 flex-wrap">
                      <button onClick={() => setModal({ type: 'editCard', data: c })} className="btn-outline btn-sm" style={{ borderColor: 'rgba(200,160,0,0.35)', color: '#c07800' }}>
                        ✏ Edit
                      </button>
                      <button onClick={() => handleRegenImage(c)} className="btn-outline btn-sm" style={{ borderColor: 'rgba(80,160,255,0.35)', color: '#5a8ab0' }}>
                        🎨 New Image
                      </button>
                      <button onClick={() => setModal({ type: 'deleteCard', data: c })} className="btn-danger btn-sm">
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Students Tab */}
        {tab === 'students' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display font-bold text-xs uppercase tracking-[0.15em]" style={{ color: '#c8a000' }}>
                Your Students
              </h2>
              <button onClick={() => setModal({ type: 'addStudent' })} className="btn-gold btn-sm">
                + Add Student
              </button>
            </div>
            {students.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-sm italic" style={{ color: '#9a7040' }}>No students yet.</span>
              </div>
            ) : (
              <table className="data-table data-table--parchment">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Login Email</th>
                    <th>Cards</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => (
                    <tr key={s.id}>
                      <td className="font-semibold">{s.name}</td>
                      <td className="text-xs" style={{ color: '#9a7040' }}>{s.login_email || '—'}</td>
                      <td>{cards.filter(c => c.student_id === s.id).length}</td>
                      <td>
                        <div className="flex gap-1.5 flex-wrap">
                          <button onClick={() => { setFilterStudent(s.id); setTab('cards'); }} className="btn-outline btn-sm" style={{ borderColor: 'rgba(90,40,10,0.25)', color: '#5a3a20' }}>
                            View
                          </button>
                          <button onClick={() => setModal({ type: 'email', data: s })} className="btn-outline btn-sm" style={{ borderColor: 'rgba(80,160,255,0.35)', color: '#5a8ab0' }}>
                            📧
                          </button>
                          <button onClick={() => setModal({ type: 'editStudent', data: s })} className="btn-outline btn-sm" style={{ borderColor: 'rgba(200,160,0,0.35)', color: '#c07800' }}>
                            ✏ Edit
                          </button>
                          <button onClick={() => { setModalError(''); setModal({ type: 'resetPassword', data: s }); }} className="btn-outline btn-sm" style={{ borderColor: 'rgba(80,200,120,0.35)', color: '#2a8a50' }}>
                            🔑 Reset PW
                          </button>
                          <button onClick={() => setModal({ type: 'deleteStudent', data: s })} className="btn-danger btn-sm">
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {tab === 'settings' && (
          <div className="max-w-[480px]">
            <h2 className="font-display font-bold text-xs uppercase tracking-[0.15em] mb-4" style={{ color: '#c8a000' }}>
              AI Settings
            </h2>
            <div className="mb-4">
              <label className="form-label form-label--parchment">Gemini API Key</label>
              <input
                type="password" className="form-input form-input--parchment"
                placeholder="AIza…" value={geminiKey}
                onChange={e => setGeminiKey(e.target.value)}
              />
              <p className="text-xs mt-1" style={{ color: '#9a7040' }}>
                One key for text generation. Free at <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="underline" style={{ color: '#c07800' }}>aistudio.google.com ↗</a>
              </p>
            </div>
            <button onClick={handleSaveKey} className="btn-gold mb-6">Save Key</button>

            <div className="my-6" style={{ borderTop: '1px solid rgba(90,50,10,0.15)' }} />

            <h2 className="font-display font-bold text-xs uppercase tracking-[0.15em] mb-4" style={{ color: '#c8a000' }}>
              Email Settings (EmailJS)
            </h2>
            <div className="mb-4">
              <label className="form-label form-label--parchment">EmailJS Public Key</label>
              <input type="password" className="form-input form-input--parchment" placeholder="public_key" value={emailKey} onChange={e => setEmailKey(e.target.value)} />
            </div>
            <div className="mb-4">
              <label className="form-label form-label--parchment">EmailJS Service ID</label>
              <input type="text" className="form-input form-input--parchment" placeholder="service_xxx" value={emailService} onChange={e => setEmailService(e.target.value)} />
            </div>
            <div className="mb-4">
              <label className="form-label form-label--parchment">EmailJS Template ID</label>
              <input type="text" className="form-input form-input--parchment" placeholder="template_xxx" value={emailTemplate} onChange={e => setEmailTemplate(e.target.value)} />
            </div>
            <button onClick={handleSaveEmail} className="btn-gold">Save Email Settings</button>
          </div>
        )}
      </div>

      {/* Modals */}
      {renderModal()}

      {/* Card Detail Modal */}
      {detailCard && (
        <div className="modal-backdrop visible" onClick={() => setDetailCard(null)}>
          <div className="modal-card modal-card--parchment modal-card--wide" onClick={e => e.stopPropagation()}>
            <button onClick={() => setDetailCard(null)} className="absolute top-4 right-4 text-xl cursor-pointer" style={{ color: '#8a5520', background: 'none', border: 'none' }}>
              ✕
            </button>
            <div className="flex gap-6 items-start flex-col md:flex-row">
              <div className="flex-shrink-0 self-center md:self-start">
                {detailCard.card_source === 'built' ? <BuiltCard card={detailCard} /> : <PokeCard card={detailCard} />}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-display font-black text-2xl mb-1" style={{ color: '#3d2b1f' }}>{detailCard.card_name}</h2>
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[12px] text-xs font-bold mb-4"
                  style={getRarityBadgeStyle(detailCard.rarity)}
                >
                  {RARITY_ICONS[detailCard.rarity]} {detailCard.rarity.toUpperCase()}
                </span>

                <p className="font-handwritten text-lg italic mb-4" style={{ color: '#7a5a40' }}>
                  "{detailCard.description}"
                </p>

                <div className="space-y-0">
                  {[
                    { label: 'HP', value: detailCard.hp.toString() },
                    { label: 'Type', value: detailCard.type },
                    { label: detailCard.stat1_name, value: detailCard.stat1_val.toString() },
                    { label: detailCard.stat2_name, value: detailCard.stat2_val.toString() },
                    { label: detailCard.stat3_name, value: detailCard.stat3_val.toString() },
                    { label: detailCard.move1_name, value: `${detailCard.move1_dmg} dmg` },
                    { label: detailCard.move2_name, value: `${detailCard.move2_dmg} dmg` },
                    { label: 'Awarded', value: new Date(detailCard.created_at).toLocaleDateString() },
                  ].map((row, i) => (
                    <div key={i} className="flex justify-between py-2" style={{ borderBottom: '1px solid rgba(90,50,10,0.1)' }}>
                      <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#9a7040' }}>{row.label}</span>
                      <span className="text-sm font-bold" style={{ color: '#3d2b1f' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <p className="text-sm mt-4 italic" style={{ color: '#7a5a40' }}>
                  Awarded to: {detailCard.students?.name || 'Unknown'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderModal() {
    if (!modal) return null;

    switch (modal.type) {
      case 'addStudent':
        return (
          <ModalWrapper title="Add New Student" onClose={() => setModal(null)}>
            <ModalForm
              fields={[
                { label: 'Student Name', name: 'name', type: 'text', placeholder: 'e.g. Jamie Chen' },
                { label: 'Student Login Email', name: 'email', type: 'email', placeholder: 'student@school.edu' },
                { label: '6-Digit PIN (keypad login)', name: 'password', type: 'password', placeholder: 'e.g. 123456' },
              ]}
              onSubmit={async (vals) => {
                setModalError('');
                const pin = vals.password;
                if (!/^\d{6}$/.test(pin)) { setModalError('PIN must be exactly 6 digits (numbers only).'); return; }
                if (/^(\d)\1{5}$/.test(pin)) { setModalError('PIN cannot be 6 of the same digit (e.g. 111111).'); return; }
                try {
                  let newUser;
                  try {
                    newUser = await Auth.signUp(vals.email, vals.password, 'student', vals.name);
                  } catch (e: any) {
                    throw new Error('Auth error: ' + e.message);
                  }
                  let newStudent;
                  try {
                    newStudent = await Dashboard.createStudent(vals.name, session.user.id, newUser.id);
                  } catch (e: any) {
                    throw new Error('Database error saving new student: ' + e.message);
                  }
                  try {
                    await Dashboard.giveWelcomeCard(newStudent.id, session.user.id);
                  } catch (e: any) {
                    console.warn('Welcome card failed (non-fatal):', e.message);
                  }
                  loadData();
                  setModal(null);
                } catch (err: any) {
                  setModalError(err.message);
                }
              }}
              submitLabel="Create Student"
              error={modalError}
              onCancel={() => setModal(null)}
            />
          </ModalWrapper>
        );
      case 'editStudent':
        return (
          <ModalWrapper title="✏ Edit Student" onClose={() => setModal(null)}>
            <ModalForm
              fields={[
                { label: 'Student Name', name: 'name', type: 'text', default: modal.data.name },
                { label: 'Login Email', name: 'email', type: 'email', default: modal.data.login_email || '' },
              ]}
              onSubmit={async (vals) => {
                try {
                  await sb.from('students').update({ name: vals.name, login_email: vals.email }).eq('id', modal.data.id);
                  loadData();
                  setModal(null);
                } catch (err: any) { setModalError(err.message); }
              }}
              submitLabel="Save Changes"
              error={modalError}
              onCancel={() => setModal(null)}
            />
          </ModalWrapper>
        );
      case 'deleteStudent':
        return (
          <ModalWrapper title="🗑 Delete Student" onClose={() => setModal(null)} danger>
            <p className="text-sm mb-2" style={{ color: '#3d2b1f' }}>Delete <strong>{modal.data.name}</strong>?</p>
            <p className="text-sm mb-4" style={{ color: '#c82020' }}>This will also delete all their cards and cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={async () => { await Dashboard.deleteStudent(modal.data.id); loadData(); setModal(null); }} className="btn-danger">Yes, Delete Everything</button>
              <button onClick={() => setModal(null)} className="btn-outline" style={{ borderColor: 'rgba(90,40,10,0.3)', color: '#5a3a20' }}>Cancel</button>
            </div>
          </ModalWrapper>
        );
      case 'email':
        return (
          <ModalWrapper title="📧 Email Cards to Student" onClose={() => setModal(null)}>
            <ModalForm
              fields={[
                { label: 'Student Name', name: 'name', type: 'text', default: modal.data.name, readonly: true },
                { label: 'Send to Email', name: 'email', type: 'email', default: modal.data.login_email || '' },
                { label: 'Personal Message', name: 'message', type: 'textarea', placeholder: 'Optional personal message...', optional: true },
              ]}
              onSubmit={async () => {
                try {
                  alert('Email sent! (EmailJS integration required)');
                  setModal(null);
                } catch (err: any) { setModalError(err.message); }
              }}
              submitLabel="Send Email"
              error={modalError}
              onCancel={() => setModal(null)}
            />
          </ModalWrapper>
        );
      case 'editCard':
        return (
          <ModalWrapper title="✏ Edit Card" onClose={() => setModal(null)}>
            <ModalForm
              fields={[
                { label: 'Card Name', name: 'cardName', type: 'text', default: modal.data.card_name },
                { label: 'HP', name: 'hp', type: 'number', default: String(modal.data.hp) },
                { label: 'Description', name: 'description', type: 'textarea', default: modal.data.description },
                { label: 'Move 1 Name', name: 'move1Name', type: 'text', default: modal.data.move1_name },
                { label: 'Move 1 Damage', name: 'move1Dmg', type: 'number', default: String(modal.data.move1_dmg) },
                { label: 'Move 2 Name', name: 'move2Name', type: 'text', default: modal.data.move2_name },
                { label: 'Move 2 Damage', name: 'move2Dmg', type: 'number', default: String(modal.data.move2_dmg) },
              ]}
              onSubmit={async (vals) => {
                try {
                  await Dashboard.updateCard(modal.data.id, {
                    card_name: vals.cardName,
                    hp: Number(vals.hp),
                    description: vals.description,
                    move1_name: vals.move1Name,
                    move1_dmg: Number(vals.move1Dmg),
                    move2_name: vals.move2Name,
                    move2_dmg: Number(vals.move2Dmg),
                  });
                  loadData();
                  setModal(null);
                } catch (err: any) { setModalError(err.message); }
              }}
              submitLabel="Save Changes"
              error={modalError}
              onCancel={() => setModal(null)}
            />
          </ModalWrapper>
        );
      case 'deleteCard':
        return (
          <ModalWrapper title="🗑 Delete Card" onClose={() => setModal(null)} danger>
            <p className="text-sm mb-2" style={{ color: '#3d2b1f' }}>Delete <strong>{modal.data.card_name}</strong>?</p>
            <p className="text-sm mb-4" style={{ color: '#c82020' }}>This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={async () => { await Dashboard.deleteCard(modal.data.id); loadData(); setModal(null); }} className="btn-danger">Yes, Delete Card</button>
              <button onClick={() => setModal(null)} className="btn-outline" style={{ borderColor: 'rgba(90,40,10,0.3)', color: '#5a3a20' }}>Cancel</button>
            </div>
          </ModalWrapper>
        );
      case 'resetPassword': {
        const pw = modal.data._pw || '';
        const pw2 = modal.data._pw2 || '';
        const setPw = (v: string) => setModal((m: any) => ({ ...m, data: { ...m.data, _pw: v } }));
        const setPw2 = (v: string) => setModal((m: any) => ({ ...m, data: { ...m.data, _pw2: v } }));
        return (
          <ModalWrapper title="🔑 Reset PIN" onClose={() => setModal(null)}>
            <p className="text-sm mb-1" style={{ color: '#7a5a40' }}>
              Setting new keypad PIN for <strong>{modal.data.name}</strong>
            </p>
            <p className="text-xs mb-4" style={{ color: '#9a7a60' }}>
              Must be exactly 6 digits. Cannot be 6 of the same number (e.g. 111111).
            </p>
            <div className="mb-3">
              <label className="form-label form-label--parchment">New 6-Digit PIN</label>
              <input type="password" inputMode="numeric" maxLength={6} className="form-input form-input--parchment" placeholder="e.g. 482951" value={pw} onChange={e => setPw(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            </div>
            <div className="mb-3">
              <label className="form-label form-label--parchment">Confirm PIN</label>
              <input type="password" inputMode="numeric" maxLength={6} className="form-input form-input--parchment" placeholder="Repeat PIN" value={pw2} onChange={e => setPw2(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            </div>
            {modalError && <p className="text-sm mt-2" style={{ color: '#c82020' }}>{modalError}</p>}
            <div className="flex gap-3 mt-4">
              <button className="btn-gold" onClick={async () => {
                if (!/^\d{6}$/.test(pw)) { setModalError('PIN must be exactly 6 digits.'); return; }
                if (/^(\d)\1{5}$/.test(pw)) { setModalError('PIN cannot be 6 of the same digit (e.g. 111111).'); return; }
                if (pw !== pw2) { setModalError('PINs do not match.'); return; }
                if (!modal.data.auth_user_id) { setModalError('Student has no linked account.'); return; }
                try {
                  const { data: { session: s } } = await sb.auth.getSession();
                  const res = await fetch('https://iunoahajcaaxmttdpgem.supabase.co/functions/v1/update-user-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${s?.access_token}` },
                    body: JSON.stringify({ userId: modal.data.auth_user_id, newPassword: pw }),
                  });
                  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
                  setModal(null);
                } catch (err: any) { setModalError(err.message); }
              }}>Set PIN</button>
              <button onClick={() => setModal(null)} className="btn-outline" style={{ borderColor: 'rgba(90,40,10,0.3)', color: '#5a3a20' }}>Cancel</button>
            </div>
          </ModalWrapper>
        );
      }
      default: return null;
    }
  }

  async function handleRegenImage(card: Card) {
    setWorking('Regenerating image…');
    try {
      const newUrl = AI.generateImageUrl(card.card_name + ' ' + card.type);
      await new Promise<void>(r => { const img = new Image(); img.onload = () => r(); img.onerror = () => r(); img.src = newUrl; setTimeout(r, 2000); });
      await Dashboard.updateCard(card.id, { image_url: newUrl });
      loadData();
      setDone('Image regenerated');
    } catch (err: any) { setErr(err.message); }
  }
}

// ── Modal Components ──

function ModalWrapper({ title, children, onClose, danger }: { title: string; children: React.ReactNode; onClose: () => void; danger?: boolean }) {
  return (
    <div className="modal-backdrop visible" onClick={onClose}>
      <div className="modal-card modal-card--parchment" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-xl cursor-pointer" style={{ color: '#8a5520', background: 'none', border: 'none' }}>✕</button>
        <h3 className="font-display font-bold text-lg mb-4" style={{ color: danger ? '#c82020' : '#3d2b1f' }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function ModalForm({ fields, onSubmit, submitLabel, error, onCancel }: {
  fields: { label: string; name: string; type: string; placeholder?: string; default?: string; readonly?: boolean; optional?: boolean }[];
  onSubmit: (vals: Record<string, string>) => void;
  submitLabel: string;
  error: string;
  onCancel: () => void;
}) {
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    fields.forEach(f => init[f.name] = f.default || '');
    return init;
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit(vals);
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      {fields.map(f => (
        <div key={f.name} className="mb-3">
          <label className="form-label form-label--parchment">{f.label} {f.optional && <span className="text-xs" style={{ color: '#9a7040' }}>(optional)</span>}</label>
          {f.type === 'textarea' ? (
            <textarea className="form-input form-input--parchment resize-none" rows={2} placeholder={f.placeholder} value={vals[f.name] || ''} onChange={e => setVals(p => ({ ...p, [f.name]: e.target.value }))} />
          ) : (
            <input type={f.type} className="form-input form-input--parchment" placeholder={f.placeholder} value={vals[f.name] || ''} readOnly={f.readonly} onChange={e => setVals(p => ({ ...p, [f.name]: e.target.value }))} />
          )}
        </div>
      ))}
      {error && <div className="alert-error mb-3 text-xs">{error}</div>}
      <div className="flex gap-3">
        <button type="submit" disabled={submitting} className="btn-gold">{submitting ? 'Saving…' : submitLabel}</button>
        <button type="button" onClick={onCancel} className="btn-outline" style={{ borderColor: 'rgba(90,40,10,0.3)', color: '#5a3a20' }}>Cancel</button>
      </div>
    </form>
  );
}

function getRarityBadgeStyle(rarity: string): React.CSSProperties {
  switch (rarity) {
    case 'prismatic':
      return {
        background: 'linear-gradient(135deg, rgba(255,80,80,0.08), rgba(80,255,120,0.08), rgba(80,180,255,0.08), rgba(200,80,255,0.08))',
        border: '1px solid rgba(160,80,255,0.3)',
        color: '#8040a0',
      };
    case 'gold-rare':
      return { background: 'rgba(212,160,23,0.1)', border: '1px solid rgba(212,160,23,0.3)', color: '#c07800' };
    case 'silver':
      return { background: 'rgba(120,160,190,0.1)', border: '1px solid rgba(120,160,190,0.3)', color: '#5a7a90' };
    default:
      return { background: 'rgba(200,160,0,0.1)', border: '1px solid rgba(200,160,0,0.3)', color: '#8b6a00' };
  }
}




// ── Build a Card Tab Component ──────────────────────────────

const TYPE_OPTIONS = [
  { id: 'fire',     label: 'Fire',     color: '#ef4444' },
  { id: 'water',    label: 'Water',    color: '#3b82f6' },
  { id: 'nature',   label: 'Nature',   color: '#22c55e' },
  { id: 'electric', label: 'Electric', color: '#eab308' },
  { id: 'psychic',  label: 'Psychic',  color: '#a855f7' },
];

const RARITY_OPTIONS = [
  { id: 'common',    label: 'Common',    color: '#9ca3af' },
  { id: 'silver',    label: 'Silver',    color: '#94a3b8' },
  { id: 'gold-rare', label: 'Gold',      color: '#f59e0b' },
  { id: 'prismatic', label: 'Prismatic', color: '#a855f7' },
];

// Inject holo CSS once
const HOLO_CSS = `
  .holo-overlay {
    position: absolute; inset: 0; pointer-events: none;
    opacity: 0; transition: opacity 0.3s; z-index: 2; border-radius: 8px;
  }
  .build-card-wrap:hover .holo-overlay { opacity: 1; }
  .rarity-silver .holo-overlay {
    background: linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.4) 25%, transparent 30%);
    background-size: 200% 200%; animation: bc-shimmer 3s infinite linear; mix-blend-mode: overlay;
  }
  .rarity-gold-rare .holo-overlay {
    background:
      linear-gradient(105deg, transparent 20%, rgba(160,196,255,0.5) 25%, rgba(185,251,192,0.5) 30%, transparent 35%),
      url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='20' cy='20' r='10' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2'/%3E%3Ccircle cx='28' cy='12' r='4' fill='rgba(255,255,255,0.4)'/%3E%3C/svg%3E");
    background-size: 200% 200%, 40px 40px; animation: bc-shimmer-gold 2.5s infinite linear; mix-blend-mode: color-dodge;
  }
  .rarity-prismatic .holo-overlay {
    background:
      linear-gradient(125deg, #ff000055, #ff7f0055, #ffff0055, #00ff0055, #0000ff55, #4b008255, #9400d355),
      url("data:image/svg+xml,%3Csvg width='50' height='50' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M25 8L31.2 18.5L43 20.8L35 29.5L36.5 41.5L25 36.5L13.5 41.5L15 29.5L7 20.8L18.8 18.5L25 8Z' fill='rgba(255,255,255,0.5)'/%3E%3Cpath d='M20 28.5L18.5 27.1C13.4 22.5 10 19.4 10 15.5C10 12.4 12.4 10 15.5 10C17.2 10 18.9 10.8 20 12.1C21.1 10.8 22.8 10 24.5 10C27.6 10 30 12.4 30 15.5C30 19.4 26.6 22.5 21.5 27.1L20 28.5Z' fill='rgba(255,120,220,0.4)'/%3E%3Ccircle cx='10' cy='10' r='5' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='1.5'/%3E%3Ccircle cx='40' cy='38' r='4' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='1.5'/%3E%3C/svg%3E");
    background-size: 400% 400%, 60px 60px; animation: bc-rainbow 4s ease infinite; mix-blend-mode: color-dodge;
  }
  @keyframes bc-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  @keyframes bc-shimmer-gold { 0% { background-position: 200% 0, 0 0; } 100% { background-position: -200% 0, 40px 40px; } }
  @keyframes bc-rainbow { 0%{background-position:0% 50%,0 0;} 50%{background-position:100% 50%,30px 30px;} 100%{background-position:0% 50%,60px 60px;} }
  .build-card-wrap {
    transition: transform 0.15s ease-out;
    transform-style: preserve-3d;
    will-change: transform;
  }
`;

function injectHoloStyles() {
  if (document.getElementById('build-card-holo-css')) return;
  const style = document.createElement('style');
  style.id = 'build-card-holo-css';
  style.textContent = HOLO_CSS;
  document.head.appendChild(style);
}

function BuildCardCard({ buildCard, buildImage, buildPosition, setBuildPosition, buildScale, buildRotation, buildIsDragging, setBuildIsDragging, buildDragStart, setBuildDragStart, rarity, isCropped }: any) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const typeColor = TYPE_OPTIONS.find(t => t.id === buildCard.type)?.color || '#ef4444';
  const rarityColor = RARITY_OPTIONS.find(r => r.id === rarity)?.color || '#9ca3af';

  React.useEffect(() => { injectHoloStyles(); }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rotX = ((y - cy) / cy) * -15;
    const rotY = ((x - cx) / cx) * 15;
    el.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.04,1.04,1.04)`;
  };
  const handleMouseLeave = () => {
    if (cardRef.current) cardRef.current.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)';
  };

  return (
    <div
      ref={cardRef}
      className={`build-card-wrap rarity-${rarity}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        width: '100%', aspectRatio: '2.5/3.5', borderRadius: 12, overflow: 'hidden',
        border: `6px solid ${typeColor}`,
        background: '#111827',
        display: 'flex', flexDirection: 'column',
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${rarityColor}44`,
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      {/* Holo overlay — toggled by CSS on hover */}
      <div className="holo-overlay" />

      {/* Gradient bg */}
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, ${typeColor}55, transparent 50%, #000)`, pointerEvents: 'none', zIndex: 0 }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.65rem', zIndex: 1, position: 'relative' }}>
        <span style={{ color: 'white', fontWeight: 700, fontSize: '0.82rem', textShadow: '1px 1px 3px black', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '68%' }}>
          {buildCard.name || 'Card Name'}
        </span>
        <span style={{ fontSize: '0.55rem', fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: rarityColor, color: '#fff', textTransform: 'uppercase', flexShrink: 0, letterSpacing: '0.05em' }}>
          {rarity}
        </span>
      </div>

      {/* Image area — z-index 3 keeps it above the holo overlay (z-index 2) */}
      <div style={{ margin: '0 0.5rem', aspectRatio: '4/3', background: '#1a1a2e', border: '2px solid #333', borderRadius: 6, overflow: 'hidden', zIndex: 3, position: 'relative', flexShrink: 0 }}>
        {buildImage ? (
          <img
            src={buildImage} alt="card art" draggable={false}
            onMouseDown={(e) => { if (isCropped) return; e.preventDefault(); setBuildIsDragging(true); setBuildDragStart({ clientX: e.clientX, clientY: e.clientY, startX: buildPosition.x, startY: buildPosition.y }); }}
            onMouseMove={(e) => { if (!buildIsDragging || isCropped) return; const dx = ((e.clientX - buildDragStart.clientX) / (e.currentTarget.parentElement?.offsetWidth || 200)) * 100; const dy = ((e.clientY - buildDragStart.clientY) / (e.currentTarget.parentElement?.offsetHeight || 150)) * 100; setBuildPosition({ x: buildDragStart.startX + dx, y: buildDragStart.startY + dy }); }}
            onMouseUp={() => setBuildIsDragging(false)}
            onMouseLeave={() => setBuildIsDragging(false)}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              transform: `translate(${buildPosition.x}%, ${buildPosition.y}%) scale(${buildScale}) rotate(${buildRotation}deg)`,
              cursor: isCropped ? 'default' : (buildIsDragging ? 'grabbing' : 'grab'),
              userSelect: 'none',
            }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: '0.72rem', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '1.5rem' }}>🖼</span>No Image
          </div>
        )}
      </div>

      {/* Type badge */}
      <div style={{ textAlign: 'center', padding: '3px 0', fontSize: '0.62rem', fontWeight: 800, color: typeColor, background: 'rgba(0,0,0,0.5)', letterSpacing: '0.2em', textTransform: 'uppercase', zIndex: 1, position: 'relative' }}>
        ✦ {buildCard.type} ✦
      </div>

      {/* Description */}
      <div style={{ flex: 1, margin: '0.25rem 0.5rem', padding: '0.35rem 0.5rem', background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', zIndex: 1, position: 'relative' }}>
        <p style={{ color: '#ccc', fontSize: '0.63rem', lineHeight: 1.45, fontStyle: 'italic', margin: 0 }}>
          {buildCard.description || 'A mysterious creature of untold power...'}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', justifyContent: 'space-around', padding: '0.4rem 0.5rem', background: 'rgba(0,0,0,0.75)', margin: '0 0.5rem 0.5rem', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', zIndex: 1, position: 'relative' }}>
        <span style={{ color: '#ff9999', fontSize: '0.75rem', fontWeight: 800 }}>⚔️ {buildCard.attack}</span>
        <span style={{ color: '#99ccff', fontSize: '0.75rem', fontWeight: 800 }}>🛡️ {buildCard.defense}</span>
        <span style={{ color: '#99ffcc', fontSize: '0.75rem', fontWeight: 800 }}>💨 {buildCard.speed}</span>
      </div>
    </div>
  );
}

function BuildCardTab({
  students, buildStudent, setBuildStudent,
  buildImage, setBuildImage,
  buildCroppedImage, setBuildCroppedImage,
  buildScale, setBuildScale,
  buildRotation, setBuildRotation,
  buildPosition, setBuildPosition,
  buildIsDragging, setBuildIsDragging,
  buildDragStart, setBuildDragStart,
  buildCard, setBuildCard,
  buildSaving, setBuildSaving,
  buildSaved, setBuildSaved,
  session, onSaved,
}: any) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setBuildImage(ev.target?.result as string);
      setBuildCroppedImage(null);
      setBuildScale(1); setBuildRotation(0); setBuildPosition({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const resetImage = () => { setBuildScale(1); setBuildRotation(0); setBuildPosition({ x: 0, y: 0 }); setBuildCroppedImage(null); };

  // Bake the current crop transform into a canvas data URL
  // Renders identically to objectFit:cover + the user's scale/rotate/position adjustments
  const cropImage = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!buildImage) { reject(new Error('No image')); return; }
      const OUTPUT_W = 400;
      const OUTPUT_H = 300; // 4:3 matches the card image area
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_W;
      canvas.height = OUTPUT_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas error')); return; }
      const img = new Image();
      img.onload = () => {
        ctx.save();
        // Step 1: Start from centre of canvas
        ctx.translate(OUTPUT_W / 2, OUTPUT_H / 2);
        // Step 2: Apply user's rotation
        ctx.rotate((buildRotation * Math.PI) / 180);
        // Step 3: Apply user's zoom scale
        ctx.scale(buildScale, buildScale);
        // Step 4: Apply user's pan (buildPosition is % of output size)
        ctx.translate((buildPosition.x / 100) * OUTPUT_W, (buildPosition.y / 100) * OUTPUT_H);
        // Step 5: Calculate cover scale (same as CSS objectFit:cover)
        const coverScale = Math.max(OUTPUT_W / img.naturalWidth, OUTPUT_H / img.naturalHeight);
        const drawW = img.naturalWidth * coverScale;
        const drawH = img.naturalHeight * coverScale;
        // Step 6: Draw centred
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = () => reject(new Error('Image load error'));
      img.crossOrigin = 'anonymous';
      img.src = buildImage;
    });
  };

  const handleCrop = async () => {
    try {
      const cropped = await cropImage();
      setBuildCroppedImage(cropped);
    } catch (err: any) {
      alert(err.message || 'Crop failed');
    }
  };

  const handleSave = async () => {
    if (!buildStudent) { alert('Please select a student first.'); return; }
    if (!buildCard.name.trim()) { alert('Please enter a card name.'); return; }
    setBuildSaving(true); setBuildSaved(false);
    try {
      const cardToSave = {
        card_name: buildCard.name,
        hp: buildCard.attack + buildCard.defense,
        type: buildCard.type,
        description: buildCard.description || '',
        rarity: buildCard.rarity as any,
        stat1_name: 'Attack',  stat1_val: buildCard.attack,
        stat2_name: 'Defense', stat2_val: buildCard.defense,
        stat3_name: 'Speed',   stat3_val: buildCard.speed,
        move1_name: 'Strike',  move1_dmg: Math.round(buildCard.attack * 0.8),
        move2_name: 'Endure',  move2_dmg: Math.round(buildCard.defense * 0.6),
        image_url: buildCroppedImage || buildImage || '',
        card_source: 'built' as const,
        student_id: buildStudent.id,
        teacher_id: session.user.id,
      };
      await Dashboard.saveCard(cardToSave);
      setBuildSaved(true);
      onSaved();
    } catch (err: any) { alert(err.message || 'Failed to save card'); }
    setBuildSaving(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr 280px', gap: '1.5rem', alignItems: 'start' }}>

      {/* ── Column 1: Student picker + image upload ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Student picker */}
        <div className="p-4 rounded-xs" style={{ background: 'rgba(255,248,222,0.65)', border: '1px solid rgba(90,50,10,0.18)' }}>
          <p className="form-label form-label--parchment mb-3" style={{ fontSize: '0.68rem' }}>1 · Choose Student</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: 220, overflowY: 'auto' }}>
            {students.length === 0 && <span className="text-xs italic" style={{ color: '#9a7040' }}>No students yet</span>}
            {students.map((s: any) => (
              <button key={s.id} onClick={() => setBuildStudent(s)} style={{
                padding: '0.4rem 0.65rem', borderRadius: 6, textAlign: 'left', cursor: 'pointer', fontSize: '0.8rem',
                border: buildStudent?.id === s.id ? '1.5px solid #c8a000' : '1px solid rgba(90,50,10,0.18)',
                background: buildStudent?.id === s.id ? 'rgba(200,160,0,0.14)' : 'rgba(255,248,222,0.5)',
                color: buildStudent?.id === s.id ? '#8b6a00' : '#7a5a40',
                fontWeight: buildStudent?.id === s.id ? 700 : 400,
                display: 'flex', alignItems: 'center', gap: '0.4rem',
              }}>
                {buildStudent?.id === s.id && <span>✓</span>}{s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Image upload + crop */}
        <div className="p-4 rounded-xs" style={{ background: 'rgba(255,248,222,0.65)', border: '1px solid rgba(90,50,10,0.18)' }}>
          <p className="form-label form-label--parchment mb-2" style={{ fontSize: '0.68rem' }}>2 · Upload & Crop Image</p>

          {/* Upload preview — full image visible, zoom only, no cropping here */}
          <div
            style={{
              background: '#d8d0b8', borderRadius: 6,
              border: '2px dashed rgba(90,50,10,0.25)',
              position: 'relative', marginBottom: '0.5rem',
              minHeight: 120,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
              padding: buildImage ? '0.5rem' : 0,
            }}
          >
            {buildImage ? (
              <img
                src={buildImage} alt="upload preview" draggable={false}
                style={{
                  maxWidth: '100%',
                  maxHeight: 180,
                  display: 'block',
                  borderRadius: 4,
                  transform: `scale(${buildScale}) rotate(${buildRotation}deg)`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.1s',
                  userSelect: 'none',
                }}
              />
            ) : (
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9a7040', fontSize: '0.72rem', gap: 4 }}>
                <span style={{ fontSize: '1.8rem' }}>📷</span>No image uploaded
              </div>
            )}
          </div>

          {/* Rotate buttons */}
          <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.4rem', justifyContent: 'center' }}>
            {[['↺ Left', () => setBuildRotation((r: number) => r - 90)], ['↻ Right', () => setBuildRotation((r: number) => r + 90)], ['⟳ Reset', resetImage]].map(([label, fn]: any) => (
              <button key={label as string} onClick={fn} style={{ fontSize: '0.68rem', padding: '3px 9px', border: '1px solid rgba(90,50,10,0.22)', borderRadius: 4, background: 'rgba(255,248,222,0.7)', cursor: 'pointer', color: '#7a5a40' }}>{label as string}</button>
            ))}
          </div>

          {/* Zoom slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '0.68rem', color: '#9a7040', flexShrink: 0 }}>🔍 Zoom</span>
            <input type="range" min="0.3" max="5" step="0.05" value={buildScale}
              onChange={e => setBuildScale(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: '#c8a000' }} />
            <span style={{ fontSize: '0.68rem', color: '#9a7040', flexShrink: 0, width: 32, textAlign: 'right' }}>{buildScale.toFixed(1)}×</span>
          </div>
          <p style={{ fontSize: '0.65rem', color: '#9a7040', fontStyle: 'italic', marginBottom: '0.5rem', margin: '0 0 0.5rem' }}>
            Drag the card preview (column 3) to position the image inside the card frame.
          </p>

          {/* Upload button */}
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} style={{ display: 'none' }} />
          <button onClick={() => fileInputRef.current?.click()} style={{ width: '100%', padding: '0.5rem', border: '1.5px dashed rgba(90,50,10,0.3)', borderRadius: 6, background: 'rgba(200,160,0,0.07)', color: '#8b6a00', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 700 }}>
            📁 Upload Image
          </button>
          {buildImage && (<>
            <button
              onClick={handleCrop}
              style={{ width: '100%', marginTop: '0.4rem', padding: '0.5rem', border: '2px solid rgba(80,160,80,0.5)', borderRadius: 6, background: buildCroppedImage ? 'rgba(80,160,80,0.12)' : 'rgba(80,160,80,0.06)', color: '#2a6a2a', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 800 }}
            >
              {buildCroppedImage ? '✓ Cropped — Click to Re-crop' : '✂ Crop & Apply to Card'}
            </button>
            {buildCroppedImage && (
              <p style={{ fontSize: '0.65rem', color: '#2a6a2a', textAlign: 'center', margin: '0.2rem 0 0', fontStyle: 'italic' }}>
                ✓ Cropped image will be saved with the card
              </p>
            )}
            <button onClick={() => { setBuildImage(null); setBuildCroppedImage(null); resetImage(); }} style={{ width: '100%', marginTop: '0.35rem', padding: '0.35rem', border: '1px solid rgba(200,50,50,0.2)', borderRadius: 6, background: 'transparent', color: '#b04040', fontSize: '0.75rem', cursor: 'pointer' }}>
              ✕ Remove Image
            </button>
          </>)}
        </div>
      </div>

      {/* ── Column 2: Card Details ── */}
      <div className="p-5 rounded-xs" style={{ background: 'rgba(255,248,222,0.65)', border: '1px solid rgba(90,50,10,0.18)' }}>
        <p className="form-label form-label--parchment mb-4" style={{ fontSize: '0.68rem' }}>3 · Card Details</p>

        <div className="mb-4">
          <label className="form-label form-label--parchment">Card Name</label>
          <input type="text" className="form-input form-input--parchment" placeholder="e.g. Zorg the Space Monster"
            value={buildCard.name} onChange={e => setBuildCard((p: any) => ({ ...p, name: e.target.value }))} />
        </div>

        <div className="mb-4">
          <label className="form-label form-label--parchment">Rarity</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.4rem' }}>
            {RARITY_OPTIONS.map(r => (
              <button key={r.id} onClick={() => setBuildCard((p: any) => ({ ...p, rarity: r.id }))} style={{
                padding: '0.35rem 0.2rem', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                border: buildCard.rarity === r.id ? `2px solid ${r.color}` : '1px solid rgba(90,50,10,0.18)',
                background: buildCard.rarity === r.id ? `${r.color}22` : 'rgba(255,248,222,0.5)',
                color: buildCard.rarity === r.id ? r.color : '#7a5a40',
              }}>{r.label}</button>
            ))}
          </div>
          {buildCard.rarity !== 'common' && (
            <p style={{ fontSize: '0.68rem', color: '#9a7040', marginTop: '0.35rem', fontStyle: 'italic' }}>
              ✨ Hover the card preview to see the holographic effect!
            </p>
          )}
        </div>

        <div className="mb-4">
          <label className="form-label form-label--parchment">Element Type</label>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {TYPE_OPTIONS.map(t => (
              <button key={t.id} onClick={() => setBuildCard((p: any) => ({ ...p, type: t.id }))} style={{
                padding: '0.3rem 0.7rem', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                border: buildCard.type === t.id ? `2px solid ${t.color}` : '1px solid rgba(90,50,10,0.18)',
                background: buildCard.type === t.id ? `${t.color}22` : 'rgba(255,248,222,0.5)',
                color: buildCard.type === t.id ? t.color : '#7a5a40',
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="form-label form-label--parchment">Description <span style={{ fontSize: '0.7rem', color: '#9a7040' }}>(optional)</span></label>
          <textarea className="form-input form-input--parchment resize-none" rows={3}
            placeholder="A quirky creature from the realm of imagination..."
            value={buildCard.description}
            onChange={e => setBuildCard((p: any) => ({ ...p, description: e.target.value }))} />
        </div>

        <div>
          <label className="form-label form-label--parchment">Stats</label>
          {([['attack','Attack','⚔️','#ff9999'], ['defense','Defense','🛡️','#99ccff'], ['speed','Speed','💨','#99ffcc']] as const).map(([key, label, icon, color]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
              <span style={{ width: 22, fontSize: '1rem' }}>{icon}</span>
              <span style={{ width: 54, fontSize: '0.78rem', color: '#7a5a40', fontWeight: 600 }}>{label}</span>
              <input type="range" min="0" max="120" value={(buildCard as any)[key]}
                onChange={e => setBuildCard((p: any) => ({ ...p, [key]: Number(e.target.value) }))}
                style={{ flex: 1, accentColor: color }} />
              <span style={{ width: 30, textAlign: 'right', fontSize: '0.88rem', fontWeight: 800, color }}>{(buildCard as any)[key]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Column 3: Live Preview + Save ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <p className="form-label form-label--parchment" style={{ fontSize: '0.68rem' }}>4 · Preview & Save</p>

        <BuildCardCard
          buildCard={buildCard}
          buildImage={buildCroppedImage || buildImage}
          buildPosition={buildCroppedImage ? { x: 0, y: 0 } : buildPosition}
          setBuildPosition={setBuildPosition}
          buildScale={buildCroppedImage ? 1 : buildScale}
          buildRotation={buildCroppedImage ? 0 : buildRotation}
          buildIsDragging={buildIsDragging}
          setBuildIsDragging={setBuildIsDragging}
          buildDragStart={buildDragStart}
          setBuildDragStart={setBuildDragStart}
          rarity={buildCard.rarity}
          isCropped={!!buildCroppedImage}
        />

        <p style={{ fontSize: '0.68rem', color: '#9a7040', textAlign: 'center', fontStyle: 'italic', margin: 0 }}>
          {buildCard.rarity !== 'common' ? '✨ Hover the card to see holo effects' : 'Upgrade rarity to unlock holo effects'}
        </p>

        {buildSaved ? (
          <div style={{ padding: '0.6rem', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, color: '#166534', fontSize: '0.82rem', textAlign: 'center' }}>
            ✓ Card saved to <strong>{buildStudent?.name}</strong>'s collection!
          </div>
        ) : (
          <button onClick={handleSave} disabled={buildSaving} className="btn-gold w-full"
            style={{ fontFamily: "'Cinzel',serif", fontSize: '0.9rem', opacity: buildSaving ? 0.7 : 1 }}>
            {buildSaving ? 'Saving…' : '💾 Save to Student'}
          </button>
        )}

        {buildSaved && (
          <button
            onClick={() => { setBuildSaved(false); setBuildCard({ name: '', rarity: 'common', type: 'fire', description: '', attack: 75, defense: 60, speed: 50 }); setBuildImage(null); setBuildCroppedImage(null); setBuildStudent(null); resetImage(); }}
            className="btn-outline w-full btn-sm"
            style={{ borderColor: 'rgba(90,40,10,0.25)', color: '#7a5a40' }}>
            ＋ Build Another Card
          </button>
        )}

        {!buildStudent && (
          <p style={{ fontSize: '0.72rem', color: '#b06020', textAlign: 'center', fontStyle: 'italic', margin: 0 }}>
            ← Select a student to enable saving
          </p>
        )}
      </div>

    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════
// WEEKLY PROJECT TAB
// ══════════════════════════════════════════════════════════════════════

function WeeklyProjectTab({
  students, session,
  weeklyTask, setWeeklyTask,
  weeklyTitle, setWeeklyTitle,
  weeklyCharHint, setWeeklyCharHint,
  weeklyGenerating, setWeeklyGenerating,
  weeklyCard, setWeeklyCard,
  weeklyProject, setWeeklyProject,
  weeklyStatus, setWeeklyStatus,
  weeklyStatusType, setWeeklyStatusType,
  awardModal, setAwardModal,
  awardSelections, setAwardSelections,
  awardError, setAwardError,
  awarding, setAwarding,
  weeklyEndDate, setWeeklyEndDate,
  weeklyView, setWeeklyView,
  submissions, setSubmissions,
  submissionsLoading, setSubmissionsLoading,
  onRefresh,
}: any) {

  const setWWorking = (m: string) => { setWeeklyStatus(m); setWeeklyStatusType('working'); };
  const setWDone    = (m: string) => { setWeeklyStatus(m); setWeeklyStatusType('done'); setTimeout(() => setWeeklyStatus(''), 2800); };
  const setWErr     = (m: string) => { setWeeklyStatus(m); setWeeklyStatusType('error'); };

  // ── Load submissions for this project ───────────────────────────
  const loadSubmissions = async (projectId: string) => {
    setSubmissionsLoading(true);
    try {
      const { data } = await sb
        .from('weekly_submissions')
        .select('*, students(name)')
        .eq('project_id', projectId)
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false });
      setSubmissions(data || []);
    } catch { setSubmissions([]); }
    setSubmissionsLoading(false);
  };

  // ── Generate the weekly card ─────────────────────────────────────
  const handleGenerate = async () => {
    if (!weeklyTask.trim()) { setWErr('Describe the weekly task first.'); return; }
    if (!weeklyTitle.trim()) { setWErr('Give the project a title.'); return; }
    setWeeklyGenerating(true);
    setWeeklyCard(null);
    setWWorking('Generating Weekly Project card…');
    try {
      const data = await AI.generateCardData('Weekly Project', weeklyTask, weeklyCharHint, 'gold-rare');
      data.cardName = weeklyTitle;
      setWWorking('Generating card image…');
      const imgUrl = AI.generateImageUrl(data.imagePrompt || weeklyTitle);
      await new Promise<void>(r => {
        const img = new Image();
        img.onload = () => r(); img.onerror = () => r();
        img.src = imgUrl; setTimeout(r, 2500);
      });
      const card = {
        card_name: data.cardName, hp: data.hp, type: data.type,
        description: data.description,
        stat1_name: data.stat1Name, stat1_val: data.stat1Val,
        stat2_name: data.stat2Name, stat2_val: data.stat2Val,
        stat3_name: data.stat3Name, stat3_val: data.stat3Val,
        move1_name: data.move1Name, move1_dmg: data.move1Dmg,
        move2_name: data.move2Name, move2_dmg: data.move2Dmg,
        rarity: 'gold-rare' as any,
        image_url: imgUrl,
        card_source: 'generated' as any,
      };
      setWeeklyCard(card);
      setWDone('Card generated! Save the project to publish it.');
    } catch (err: any) { setWErr(err.message || 'Generation failed'); }
    setWeeklyGenerating(false);
  };

  // ── Save / publish the weekly project ───────────────────────────
  const handleSaveProject = async () => {
    if (!weeklyCard) { setWErr('Generate a card first.'); return; }
    setWWorking('Saving project…');
    try {
      const payload: any = {
        teacher_id: session.user.id,
        title: weeklyTitle,
        task: weeklyTask,
        char_hint: weeklyCharHint,
        card_data: weeklyCard,
        week_label: getCurrentWeekLabel(),
        end_date: weeklyEndDate || null,
      };
      let saved;
      if (weeklyProject?.id) {
        const { data } = await sb.from('weekly_projects').update(payload).eq('id', weeklyProject.id).select().single();
        saved = data;
      } else {
        const { data } = await sb.from('weekly_projects').insert(payload).select().single();
        saved = data;
      }
      setWeeklyProject(saved);
      setWDone('Weekly project published! Students can now see it.');
    } catch (err: any) { setWErr(err.message); }
  };

  // ── New project ──────────────────────────────────────────────────
  const handleNewProject = () => {
    setWeeklyProject(null);
    setWeeklyTask(''); setWeeklyTitle(''); setWeeklyCharHint('');
    setWeeklyCard(null); setWeeklyStatus(''); setWeeklyEndDate('');
    setAwardSelections({}); setSubmissions([]);
  };

  // ── Award a single student from submissions view ─────────────────
  const handleAwardSubmission = async (submission: any, rarity: 'common' | 'silver' | 'gold-rare') => {
    if (!weeklyProject || !weeklyCard) return;
    try {
      const mult = rarity === 'common' ? 0.7 : rarity === 'silver' ? 0.85 : 1;
      const cardToSave = {
        ...weeklyCard,
        rarity,
        student_id: submission.student_id,
        teacher_id: session.user.id,
        card_source: 'generated' as any,
        stat1_val: Math.round(weeklyCard.stat1_val * mult),
        stat2_val: Math.round(weeklyCard.stat2_val * mult),
        stat3_val: Math.round(weeklyCard.stat3_val * mult),
        hp: Math.round((weeklyCard.hp || 100) * mult),
      };
      await Dashboard.saveCard(cardToSave as any);
      // Mark submission as awarded and delete photos
      await sb.from('weekly_submissions')
        .update({ status: 'awarded', photo1_url: null, photo2_url: null })
        .eq('id', submission.id);
      // Reload submissions
      await loadSubmissions(weeklyProject.id);
      setWDone(`✓ Awarded ${rarity} card to ${submission.students?.name || 'student'}!`);
      onRefresh();
    } catch (err: any) { setWErr(err.message); }
  };

  // ── Bulk award modal helpers (same as before) ────────────────────
  const handleOpenAward = () => { setAwardSelections({}); setAwardError(''); setAwardModal(true); };
  const handleToggleStudent = (studentId: string, rar: 'common' | 'silver' | 'gold-rare') => {
    setAwardSelections((prev: any) => {
      const next = { ...prev };
      if (next[studentId] === rar) delete next[studentId]; else next[studentId] = rar;
      return next;
    });
    setAwardError('');
  };
  const handleAward = async () => {
    if (!weeklyProject || !weeklyCard) return;
    const entries = Object.entries(awardSelections);
    if (entries.length === 0) { setAwardError('Select at least one student.'); return; }
    setAwarding(true); setAwardError('');
    try {
      let awarded = 0;
      for (const [studentId, rar] of entries) {
        const mult = rar === 'common' ? 0.7 : rar === 'silver' ? 0.85 : 1;
        await Dashboard.saveCard({
          ...weeklyCard, rarity: rar, student_id: studentId, teacher_id: session.user.id,
          card_source: 'generated' as any,
          stat1_val: Math.round(weeklyCard.stat1_val * mult),
          stat2_val: Math.round(weeklyCard.stat2_val * mult),
          stat3_val: Math.round(weeklyCard.stat3_val * mult),
          hp: Math.round((weeklyCard.hp || 100) * mult),
        } as any);
        awarded++;
      }
      setAwardModal(false); setAwardSelections({});
      setWDone(`✓ Awarded "${weeklyTitle}" card to ${awarded} student${awarded !== 1 ? 's' : ''}!`);
      onRefresh();
    } catch (err: any) { setAwardError(err.message); }
    setAwarding(false);
  };

  const awardCount = Object.keys(awardSelections).length;
  const hasProject = !!weeklyProject?.id;

  // Switch to submissions view and load
  const handleViewSubmissions = async () => {
    setWeeklyView('submissions');
    if (weeklyProject?.id) await loadSubmissions(weeklyProject.id);
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-xs uppercase tracking-[0.15em] mb-1" style={{ color: '#c8a000' }}>
            📋 Weekly Project Card
          </h2>
          <p className="text-xs italic" style={{ color: '#9a7040' }}>
            {weeklyProject?.week_label || getCurrentWeekLabel()}
            {weeklyProject?.end_date && ` · Due ${new Date(weeklyProject.end_date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}`}
            {!weeklyProject?.end_date && ' · Students see this task and earn the card for completing it'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {hasProject && (
            <>
              {/* View toggle */}
              <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(90,50,10,0.2)' }}>
                <button
                  onClick={() => setWeeklyView('project')}
                  style={{ padding: '5px 14px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', border: 'none', background: weeklyView === 'project' ? 'rgba(200,160,0,0.15)' : 'transparent', color: weeklyView === 'project' ? '#8b6a00' : '#9a7040' }}
                >📋 Project</button>
                <button
                  onClick={handleViewSubmissions}
                  style={{ padding: '5px 14px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', border: 'none', borderLeft: '1px solid rgba(90,50,10,0.2)', background: weeklyView === 'submissions' ? 'rgba(200,160,0,0.15)' : 'transparent', color: weeklyView === 'submissions' ? '#8b6a00' : '#9a7040' }}
                >📥 Submissions {submissions.length > 0 && <span style={{ background: '#c8a000', color: 'white', borderRadius: '50%', padding: '1px 5px', fontSize: '0.62rem', marginLeft: 4 }}>{submissions.length}</span>}</button>
              </div>
              <button onClick={handleOpenAward} className="btn-gold btn-sm" style={{ fontFamily: "'Cinzel',serif" }}>
                🏅 Award Students
              </button>
              <button onClick={handleNewProject} className="btn-outline btn-sm" style={{ borderColor: 'rgba(90,40,10,0.3)', color: '#7a5a40' }}>
                + New Project
              </button>
            </>
          )}
        </div>
      </div>

      {/* ══ SUBMISSIONS VIEW ═════════════════════════════════════════ */}
      {weeklyView === 'submissions' && hasProject && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold" style={{ color: '#5a3a20' }}>
              Student Submissions — {weeklyTitle}
            </h3>
            <button onClick={() => loadSubmissions(weeklyProject.id)} className="btn-outline btn-sm" style={{ borderColor: 'rgba(90,40,10,0.2)', color: '#9a7040' }}>
              ↻ Refresh
            </button>
          </div>

          {submissionsLoading ? (
            <div className="text-sm italic text-center py-8" style={{ color: '#9a7040' }}>Loading submissions…</div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12" style={{ background: 'rgba(255,248,222,0.4)', borderRadius: 16, border: '2px dashed rgba(200,160,0,0.2)' }}>
              <div style={{ fontSize: '2.5rem', opacity: 0.2, marginBottom: 8 }}>📭</div>
              <p className="text-sm italic" style={{ color: '#9a7040' }}>No pending submissions yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {submissions.map((sub: any) => (
                <div key={sub.id} style={{ background: 'rgba(255,248,222,0.7)', border: '1px solid rgba(90,50,10,0.15)', borderRadius: 16, padding: '1.2rem 1.5rem' }}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    {/* Student info */}
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div className="font-bold text-sm mb-1" style={{ color: '#3d2b1f' }}>
                        {sub.students?.name || 'Unknown student'}
                      </div>
                      <div className="text-xs italic mb-3" style={{ color: '#9a7040' }}>
                        Submitted {new Date(sub.submitted_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {/* Photos */}
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {sub.photo1_url && (
                          <a href={sub.photo1_url} target="_blank" rel="noopener noreferrer">
                            <img src={sub.photo1_url} alt="Evidence 1"
                              style={{ width: 110, height: 80, objectFit: 'cover', borderRadius: 10, border: '2px solid rgba(90,50,10,0.15)', cursor: 'pointer', transition: 'transform 0.15s' }}
                              onMouseEnter={e => { (e.target as HTMLImageElement).style.transform = 'scale(1.05)'; }}
                              onMouseLeave={e => { (e.target as HTMLImageElement).style.transform = 'scale(1)'; }}
                            />
                          </a>
                        )}
                        {sub.photo2_url && (
                          <a href={sub.photo2_url} target="_blank" rel="noopener noreferrer">
                            <img src={sub.photo2_url} alt="Evidence 2"
                              style={{ width: 110, height: 80, objectFit: 'cover', borderRadius: 10, border: '2px solid rgba(90,50,10,0.15)', cursor: 'pointer', transition: 'transform 0.15s' }}
                              onMouseEnter={e => { (e.target as HTMLImageElement).style.transform = 'scale(1.05)'; }}
                              onMouseLeave={e => { (e.target as HTMLImageElement).style.transform = 'scale(1)'; }}
                            />
                          </a>
                        )}
                        {!sub.photo1_url && !sub.photo2_url && (
                          <span className="text-xs italic" style={{ color: '#b0906a' }}>No photos attached</span>
                        )}
                      </div>
                    </div>

                    {/* Award buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      <div className="text-xs font-bold mb-1 text-center" style={{ color: '#9a7040' }}>Award as:</div>
                      {([
                        { rar: 'common'    as const, label: '⭐ Common',  color: '#8b6a00', bg: 'rgba(200,160,0,0.1)',   border: 'rgba(200,160,0,0.35)' },
                        { rar: 'silver'    as const, label: '✦ Silver',   color: '#5a7a90', bg: 'rgba(120,160,190,0.1)', border: 'rgba(120,160,190,0.4)' },
                        { rar: 'gold-rare' as const, label: '★ Gold',     color: '#c07800', bg: 'rgba(212,160,23,0.1)',  border: 'rgba(212,160,23,0.4)' },
                      ]).map(({ rar, label, color, bg, border }) => (
                        <button
                          key={rar}
                          onClick={() => handleAwardSubmission(sub, rar)}
                          style={{ padding: '6px 18px', borderRadius: 8, border: `1px solid ${border}`, background: bg, color, fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s', minWidth: 110, textAlign: 'center' }}
                          onMouseEnter={e => { (e.currentTarget).style.opacity = '0.75'; }}
                          onMouseLeave={e => { (e.currentTarget).style.opacity = '1'; }}
                        >{label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {weeklyStatus && <div className={`status-bar ${weeklyStatusType} mt-4`}>{weeklyStatus}</div>}
        </div>
      )}

      {/* ══ PROJECT VIEW ═════════════════════════════════════════════ */}
      {weeklyView === 'project' && (
        <div className="grid gap-6" style={{ gridTemplateColumns: 'minmax(320px,420px) 1fr' }}>

          {/* Left: form */}
          <div className="p-6 rounded-xs" style={{ background: 'rgba(255,248,222,0.65)', border: '1px solid rgba(90,50,10,0.18)', boxShadow: '2px 3px 12px rgba(0,0,0,0.09)' }}>

            <div className="mb-4">
              <label className="form-label form-label--parchment">Project Title</label>
              <input type="text" className="form-input form-input--parchment"
                placeholder="e.g. The Solar System Explorer"
                value={weeklyTitle} onChange={e => setWeeklyTitle(e.target.value)} />
            </div>

            <div className="mb-4">
              <label className="form-label form-label--parchment">What must students do to earn this card?</label>
              <textarea className="form-input form-input--parchment resize-none" style={{ minHeight: 90 }}
                placeholder="e.g. Create a poster showing the 8 planets in our solar system..."
                value={weeklyTask} onChange={e => setWeeklyTask(e.target.value)} />
              <p className="text-xs mt-1 italic" style={{ color: '#9a7040' }}>This text appears as the task on the student's page.</p>
            </div>

            <div className="mb-4">
              <label className="form-label form-label--parchment">
                Card Character Style <span className="text-xs" style={{ color: '#9a7040' }}>(optional)</span>
              </label>
              <input type="text" className="form-input form-input--parchment"
                placeholder="e.g. space explorer robot, planet dragon, cosmic owl…"
                value={weeklyCharHint} onChange={e => setWeeklyCharHint(e.target.value)} />
            </div>

            {/* End date */}
            <div className="mb-5">
              <label className="form-label form-label--parchment">
                Due Date <span className="text-xs" style={{ color: '#9a7040' }}>(optional — shown to students)</span>
              </label>
              <input type="date" className="form-input form-input--parchment"
                value={weeklyEndDate} onChange={e => setWeeklyEndDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
              {weeklyEndDate && (
                <button onClick={() => setWeeklyEndDate('')} className="text-xs mt-1" style={{ color: '#9a7040', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Clear date
                </button>
              )}
            </div>

            <button onClick={handleGenerate} disabled={weeklyGenerating} className="btn-gold w-full mb-3"
              style={{ fontFamily: "'Cinzel',serif", fontSize: '0.95rem', letterSpacing: '0.08em' }}>
              {weeklyGenerating ? 'Generating…' : '✦ Generate Card ✦'}
            </button>

            {weeklyCard && !weeklyGenerating && (
              <button onClick={handleSaveProject} className="w-full py-2 rounded-lg text-sm font-bold"
                style={{ background: 'rgba(80,200,120,0.12)', border: '1px solid rgba(80,200,120,0.4)', color: '#1a6a3a', cursor: 'pointer' }}>
                {hasProject ? '💾 Update Project' : '🚀 Publish Project'}
              </button>
            )}

            {weeklyStatus && <div className={`status-bar ${weeklyStatusType} mt-3`}>{weeklyStatus}</div>}
          </div>

          {/* Right: preview */}
          <div className="flex flex-col gap-4">
            {weeklyCard ? (
              <>
                <div className="flex justify-center">
                  <PokeCard card={weeklyCard as Card} showShimmerBtn />
                </div>
                <div className="p-5 rounded-xs" style={{ background: 'rgba(255,248,222,0.65)', border: '1px solid rgba(90,50,10,0.18)' }}>
                  <div className="text-xs uppercase tracking-widest mb-2" style={{ color: '#c8a000', fontFamily: "'Cinzel',serif" }}>📋 Student View Preview</div>
                  <h3 className="font-display font-black text-base mb-2" style={{ color: '#3d2b1f' }}>{weeklyTitle || 'Project Title'}</h3>
                  {weeklyEndDate && <p className="text-xs font-bold mb-2" style={{ color: '#c07800' }}>📅 Due: {new Date(weeklyEndDate).toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' })}</p>}
                  <p className="text-sm" style={{ color: '#5a3a20', lineHeight: 1.7 }}>{weeklyTask || 'Task description will appear here.'}</p>
                  {hasProject && <div className="mt-3 text-xs" style={{ color: '#4a8a4a', fontWeight: 700 }}>✓ Published · Students can see this</div>}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xs" style={{ minHeight: 380, border: '2px dashed rgba(200,160,0,0.2)', background: 'rgba(255,248,222,0.3)' }}>
                <span className="text-5xl mb-3" style={{ opacity: 0.2 }}>📋</span>
                <span className="text-sm italic" style={{ color: '#9a7040' }}>Fill in the task and click Generate</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ Bulk Award Modal ═══════════════════════════════════════════ */}
      {awardModal && (
        <div className="modal-backdrop visible" onClick={() => { if (!awarding) setAwardModal(false); }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fffbf0', border: '2px solid rgba(90,50,10,0.25)', borderRadius: 20, padding: '2rem', width: '95%', maxWidth: 780, maxHeight: '90vh', overflowY: 'auto', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <button onClick={() => setAwardModal(false)} style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#8a5520' }}>✕</button>
            <h3 className="font-display font-black text-xl mb-1" style={{ color: '#3d2b1f' }}>🏅 Award "{weeklyTitle}"</h3>
            <p className="text-xs mb-5 italic" style={{ color: '#9a7040' }}>Tick each student in the column matching their achievement level. Each student can only receive one rarity.</p>
            {awardError && <div className="alert-error mb-4 text-sm">{awardError}</div>}
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {([
                { key: 'common', label: 'Common', icon: '⭐', desc: 'Completed the task', color: '#8b6a00', bg: 'rgba(200,160,0,0.07)', border: 'rgba(200,160,0,0.3)' },
                { key: 'silver', label: 'Silver', icon: '✦', desc: 'Good effort & quality', color: '#5a7a90', bg: 'rgba(120,160,190,0.07)', border: 'rgba(120,160,190,0.35)' },
                { key: 'gold-rare', label: 'Gold', icon: '★', desc: 'Outstanding work', color: '#c07800', bg: 'rgba(212,160,23,0.07)', border: 'rgba(212,160,23,0.35)' },
              ] as const).map(col => (
                <div key={col.key} style={{ border: `1px solid ${col.border}`, borderRadius: 14, padding: '1rem', background: col.bg }}>
                  <div className="text-center mb-3">
                    <div className="text-2xl mb-1">{col.icon}</div>
                    <div className="font-display font-black text-sm" style={{ color: col.color }}>{col.label}</div>
                    <div className="text-xs italic" style={{ color: '#9a7040' }}>{col.desc}</div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {students.length === 0 && <span className="text-xs italic" style={{ color: '#9a7040' }}>No students</span>}
                    {students.map((s: any) => {
                      const selected = awardSelections[s.id] === col.key;
                      const selectedOther = awardSelections[s.id] && awardSelections[s.id] !== col.key;
                      return (
                        <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, cursor: 'pointer', background: selected ? col.bg : 'transparent', border: selected ? `1.5px solid ${col.border}` : '1.5px solid transparent', opacity: selectedOther ? 0.4 : 1, transition: 'all 0.15s' }}>
                          <input type="checkbox" checked={selected} onChange={() => handleToggleStudent(s.id, col.key)} style={{ accentColor: col.color, width: 16, height: 16, flexShrink: 0 }} />
                          <span className="text-sm font-semibold" style={{ color: '#3d2b1f' }}>{s.name}</span>
                          {selected && <span className="text-xs ml-auto" style={{ color: col.color }}>✓</span>}
                          {selectedOther && <span className="text-xs ml-auto italic" style={{ color: '#9a7040' }}>→ {awardSelections[s.id]}</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(90,50,10,0.12)' }}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="text-sm" style={{ color: '#5a3a20' }}>
                  {awardCount > 0
                    ? <>Awarding to <strong>{awardCount}</strong> student{awardCount !== 1 ? 's' : ''}: {Object.entries(awardSelections).map(([sid, rar]: any) => `${students.find((s: any) => s.id === sid)?.name || sid} (${rar})`).join(', ')}</>
                    : <span className="italic" style={{ color: '#9a7040' }}>No students selected yet</span>}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setAwardModal(false)} className="btn-outline btn-sm" style={{ borderColor: 'rgba(90,40,10,0.3)', color: '#7a5a40' }}>Cancel</button>
                  <button onClick={handleAward} disabled={awarding || awardCount === 0} className="btn-gold" style={{ opacity: awardCount === 0 ? 0.4 : 1, fontFamily: "'Cinzel',serif" }}>
                    {awarding ? 'Awarding…' : `🏅 Award ${awardCount > 0 ? awardCount + ' Student' + (awardCount !== 1 ? 's' : '') : ''}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getCurrentWeekLabel(): string {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
  return `Week of ${fmt(start)} – ${fmt(end)}`;
}


export default TeacherPage;
