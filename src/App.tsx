import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { io, type Socket } from "socket.io-client";
import QRCode from "qrcode";
import type {
  ActionResponse,
  CardPayload,
  ClientToServerEvents,
  DeckSize,
  RoomSnapshot,
  RoundPreparePayload,
  RoundResultPayload,
  ServerToClientEvents,
  SessionPayload,
} from "../shared/types";
import { DECK_SIZE_OPTIONS } from "../shared/types";
import { SYMBOLS } from "./symbols";
import { getSymbolVariation } from "./cardVariation";

type Session = Pick<SessionPayload, "roomCode" | "playerId" | "playerToken">;
type Profile = { identityToken: string; name: string; avatarId: number };
type RecentGroup = { groupId: string; players: Array<{ name: string; avatarId: number }>; updatedAt: number };
type EntryTarget = { kind: "group"; value: string } | { kind: "code"; value: string };

const DECK_SIZE_LABELS: Record<DeckSize, string> = {
  18: "קצר",
  36: "רגיל",
  57: "מלא",
};

const SESSION_KEY = "dobble-live-session";
const PROFILE_KEY = "dobble-live-profile";
const RECENT_GROUP_KEY = "dobble-live-recent-group";
const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const AVATAR_CHOICES = [2, 5, 9, 13, 16, 22, 28, 31, 33, 40, 41, 44, 45, 52, 55, 56] as const;
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
  transports: ["websocket", "polling"],
  reconnection: true,
});

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function createProfile(): Profile {
  const avatarId = AVATAR_CHOICES[Math.floor(Math.random() * AVATAR_CHOICES.length)];
  return { identityToken: randomToken(), name: SYMBOLS[avatarId].label, avatarId };
}

function readProfile(): Profile {
  try {
    const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "null") as Partial<Profile> | null;
    if (
      stored
      && typeof stored.identityToken === "string"
      && /^[A-Za-z0-9_-]{16,128}$/.test(stored.identityToken)
      && typeof stored.name === "string"
      && stored.name.trim().length > 0
      && Number.isInteger(stored.avatarId)
      && Number(stored.avatarId) >= 0
      && Number(stored.avatarId) < SYMBOLS.length
    ) {
      return { identityToken: stored.identityToken, name: stored.name.trim(), avatarId: Number(stored.avatarId) };
    }
  } catch {
    // A fresh local identity is safer than blocking the entry flow on malformed storage.
  }
  const profile = createProfile();
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

function readSession(): Session | null {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    return value ? (JSON.parse(value) as Session) : null;
  } catch {
    return null;
  }
}

function readRecentGroup(): RecentGroup | null {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_GROUP_KEY) ?? "null") as RecentGroup | null;
    return value && /^[A-Za-z0-9_-]{8,32}$/.test(value.groupId) && Array.isArray(value.players) ? value : null;
  } catch {
    return null;
  }
}

function readEntryTarget(): EntryTarget | null {
  const groupMatch = window.location.pathname.match(/^\/r\/([A-Za-z0-9_-]{8,32})\/?$/);
  if (groupMatch) return { kind: "group", value: groupMatch[1] };
  const codeMatch = window.location.pathname.match(/^\/(?:j\/)?([A-HJ-NP-Z2-9]{4})\/?$/i);
  return codeMatch ? { kind: "code", value: codeMatch[1].toUpperCase() } : null;
}

function identityInput(profile: Profile) {
  return { name: profile.name, avatarId: profile.avatarId, identityToken: profile.identityToken };
}

function avatarSymbol(avatarId: number) {
  return SYMBOLS[avatarId] ?? SYMBOLS[0];
}

export function App() {
  const [profile, setProfile] = useState<Profile>(() => readProfile());
  const profileRef = useRef(profile);
  const [editingProfile, setEditingProfile] = useState(false);
  const [joinCode, setJoinCode] = useState(() => readEntryTarget()?.kind === "code" ? readEntryTarget()!.value : "");
  const [recentGroup, setRecentGroup] = useState<RecentGroup | null>(() => readRecentGroup());
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [round, setRound] = useState<RoundPreparePayload | null>(null);
  const [result, setResult] = useState<RoundResultPayload | null>(null);
  const [lockUntil, setLockUntil] = useState(0);
  const [wrongSymbol, setWrongSymbol] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [restoring, setRestoring] = useState(Boolean(session || readEntryTarget()));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copyState, setCopyState] = useState<"code" | "link" | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const saveSession = useCallback((payload: SessionPayload) => {
    const next = {
      roomCode: payload.roomCode,
      playerId: payload.playerId,
      playerToken: payload.playerToken,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setSession(next);
    setRoom(payload.room);
    if (payload.room.groupId) {
      const path = `/r/${payload.room.groupId}`;
      if (window.location.pathname !== path) window.history.replaceState(null, "", path);
    }
  }, []);

  const clearSession = useCallback((goHome = false) => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setRoom(null);
    setRound(null);
    setResult(null);
    setLockUntil(0);
    if (goHome && window.location.pathname !== "/") window.history.replaceState(null, "", "/");
  }, []);

  const completeEntry = useCallback((response: ActionResponse<SessionPayload>) => {
    setBusy(false);
    setRestoring(false);
    if (response.ok) {
      setMessage("");
      saveSession(response);
      const currentProfile = profileRef.current;
      socket.emit("player:update", { name: currentProfile.name, avatarId: currentProfile.avatarId }, () => undefined);
    } else {
      clearSession(false);
      setMessage(response.message);
    }
  }, [clearSession, saveSession]);

  const syncClock = useCallback(async () => {
    const samples: Array<{ rtt: number; offset: number }> = [];
    for (let index = 0; index < 3; index += 1) {
      const sentAt = Date.now();
      const serverNow = await new Promise<number>((resolve) => socket.emit("time:ping", sentAt, resolve));
      const receivedAt = Date.now();
      samples.push({ rtt: receivedAt - sentAt, offset: serverNow - (sentAt + receivedAt) / 2 });
    }
    samples.sort((a, b) => a.rtt - b.rtt);
    setClockOffset(samples[0]?.offset ?? 0);
  }, []);

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      setMessage("");
      void syncClock();
      const target = readEntryTarget();
      const currentProfile = profileRef.current;
      if (target?.kind === "group") {
        socket.emit("room:join-group", { ...identityInput(currentProfile), groupId: target.value }, completeEntry);
        return;
      }
      if (target?.kind === "code") {
        socket.emit("room:join", { ...identityInput(currentProfile), code: target.value }, completeEntry);
        return;
      }
      const stored = readSession();
      if (stored) {
        socket.emit("room:resume", { code: stored.roomCode, playerToken: stored.playerToken }, (response) => {
          if (!response.ok && response.code === "session_expired") {
            clearSession(false);
            setRestoring(false);
            setMessage("");
            return;
          }
          completeEntry(response);
        });
      } else {
        setRestoring(false);
      }
    };
    const onDisconnect = () => setConnected(false);
    const onRoom = (nextRoom: RoomSnapshot) => setRoom(nextRoom);
    const onRound = (nextRound: RoundPreparePayload) => {
      setRound(nextRound);
      setResult(null);
      setLockUntil(0);
      setWrongSymbol(null);
    };
    const onResult = (nextResult: RoundResultPayload) => {
      setResult(nextResult);
      setLockUntil(0);
    };
    const onLocked = ({ lockUntil: until }: { roundId: string; lockUntil: number }) => setLockUntil(until);
    const onNotice = ({ message: notice }: { message: string }) => setMessage(notice);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room:state", onRoom);
    socket.on("round:prepare", onRound);
    socket.on("round:result", onResult);
    socket.on("player:locked", onLocked);
    socket.on("server:notice", onNotice);
    socket.connect();
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:state", onRoom);
      socket.off("round:prepare", onRound);
      socket.off("round:result", onResult);
      socket.off("player:locked", onLocked);
      socket.off("server:notice", onNotice);
      socket.disconnect();
    };
  }, [clearSession, completeEntry, syncClock]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => {
    if (wrongTimer.current) clearTimeout(wrongTimer.current);
  }, []);

  useEffect(() => {
    if (!room?.groupId || room.players.length < 2) return;
    const recent: RecentGroup = {
      groupId: room.groupId,
      players: room.players.slice(0, 4).map(({ name, avatarId }) => ({ name, avatarId })),
      updatedAt: Date.now(),
    };
    localStorage.setItem(RECENT_GROUP_KEY, JSON.stringify(recent));
    setRecentGroup(recent);
  }, [room]);

  const enter = (kind: "quick" | "create" | "code" | "group", value?: string) => {
    if (!connected || busy) return;
    setBusy(true);
    setRound(null);
    setResult(null);
    setMessage("");
    const identity = identityInput(profile);
    if (kind === "quick") socket.emit("room:matchmake", identity, completeEntry);
    if (kind === "create") socket.emit("room:create", identity, completeEntry);
    if (kind === "code") socket.emit("room:join", { ...identity, code: value ?? "" }, completeEntry);
    if (kind === "group") socket.emit("room:join-group", { ...identity, groupId: value ?? "" }, completeEntry);
  };

  const startGame = (restart = false) => {
    setBusy(true);
    setMessage("");
    socket.emit(restart ? "game:restart" : "game:start", (response) => {
      setBusy(false);
      if (!response.ok) setMessage(response.message);
    });
  };

  const updateDeckSize = (deckSize: DeckSize) => {
    setMessage("");
    socket.emit("room:settings", { deckSize }, (response) => {
      if (!response.ok) setMessage(response.message);
    });
  };

  const leaveRoom = () => {
    socket.emit("room:leave", () => undefined);
    clearSession(true);
  };

  const updateProfile = (nextProfile: Profile) => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
    profileRef.current = nextProfile;
    setProfile(nextProfile);
    setEditingProfile(false);
    if (session) {
      socket.emit("player:update", { name: nextProfile.name, avatarId: nextProfile.avatarId }, (response) => {
        if (!response.ok) setMessage(response.message);
      });
    }
  };

  const pickSymbol = (symbolId: number) => {
    const serverNow = Date.now() + clockOffset;
    if (!round || result || serverNow < round.startsAt || serverNow < lockUntil || !connected) return;
    socket.emit("round:pick", { roundId: round.id, symbolId }, (response) => {
      if (!response.ok) {
        if (response.code !== "round_closed") setMessage(response.message);
        return;
      }
      if (response.result === "wrong") {
        setWrongSymbol(symbolId);
        if (response.lockUntil) setLockUntil(response.lockUntil);
        if (wrongTimer.current) clearTimeout(wrongTimer.current);
        wrongTimer.current = setTimeout(() => setWrongSymbol(null), 520);
      }
    });
  };

  const inviteUrl = room
    ? `${window.location.origin}${room.groupId ? `/r/${room.groupId}` : `/${room.code.toLowerCase()}`}`
    : "";

  const copyCode = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopyState("code");
      setTimeout(() => setCopyState(null), 1_600);
    } catch {
      setMessage(`קוד החדר: ${room.code}`);
    }
  };

  const shareInvite = async () => {
    if (!room) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Dobble Live", text: "מצטרפים למשחק Dobble?", url: inviteUrl });
      } else {
        await navigator.clipboard.writeText(inviteUrl);
        setCopyState("link");
        setTimeout(() => setCopyState(null), 1_600);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("לא הצלחנו לפתוח את השיתוף. אפשר להשתמש בקוד החדר.");
    }
  };

  const editor = editingProfile
    ? <ProfileEditor profile={profile} onSave={updateProfile} onClose={() => setEditingProfile(false)} />
    : null;

  if (restoring) {
    return <><LoadingScreen connected={connected} />{editor}</>;
  }

  if (!session || !room) {
    return (
      <>
        <WelcomeScreen
          profile={profile}
          connected={connected}
          busy={busy}
          message={message}
          joinCode={joinCode}
          recentGroup={recentGroup}
          onEditProfile={() => setEditingProfile(true)}
          onJoinCodeChange={setJoinCode}
          onQuickPlay={() => enter("quick")}
          onCreate={() => enter("create")}
          onJoin={() => enter("code", joinCode)}
          onRecent={() => recentGroup && enter("group", recentGroup.groupId)}
        />
        {editor}
      </>
    );
  }

  const serverNow = now + clockOffset;
  const me = room.players.find((player) => player.id === session.playerId);
  return (
    <>
      <main className="app-shell">
        <TopBar
          room={room}
          profile={profile}
          connected={connected}
          copied={copyState === "code"}
          onCopy={copyCode}
          onEditProfile={() => setEditingProfile(true)}
          onLeave={leaveRoom}
        />
        {message && <Toast message={message} onClose={() => setMessage("")} />}
        {!connected && <div className="connection-banner">מנסים להתחבר מחדש…</div>}
        {room.phase === "lobby" && (
          <Lobby
            room={room}
            playerId={session.playerId}
            busy={busy}
            copiedCode={copyState === "code"}
            copiedLink={copyState === "link"}
            inviteUrl={inviteUrl}
            serverNow={serverNow}
            onCopy={copyCode}
            onInvite={shareInvite}
            onDeckSizeChange={updateDeckSize}
            onStart={() => startGame(false)}
          />
        )}
        {room.phase === "playing" && round && (
          <GameBoard
            room={room}
            playerId={session.playerId}
            round={round}
            result={result}
            serverNow={serverNow}
            lockUntil={lockUntil}
            wrongSymbol={wrongSymbol}
            connected={connected}
            onPick={pickSymbol}
          />
        )}
        {room.phase === "playing" && !round && <WaitingForNextRound room={room} inviteUrl={inviteUrl} onInvite={shareInvite} />}
        {room.phase === "results" && (
          <Results
            room={room}
            playerId={session.playerId}
            busy={busy}
            onDeckSizeChange={updateDeckSize}
            onRestart={() => startGame(true)}
          />
        )}
        <span className="sr-only" aria-live="polite">{me ? `הניקוד שלך הוא ${me.score}` : ""}</span>
      </main>
      {editor}
    </>
  );
}

function WelcomeScreen(props: {
  profile: Profile;
  connected: boolean;
  busy: boolean;
  message: string;
  joinCode: string;
  recentGroup: RecentGroup | null;
  onEditProfile: () => void;
  onJoinCodeChange: (value: string) => void;
  onQuickPlay: () => void;
  onCreate: () => void;
  onJoin: () => void;
  onRecent: () => void;
}) {
  const sanitizeCode = (value: string) => value
    .toUpperCase()
    .split("")
    .filter((character) => ROOM_ALPHABET.includes(character))
    .join("")
    .slice(0, 4);
  const recentNames = props.recentGroup?.players.map((player) => player.name).join(", ");

  return (
    <main className="welcome-page">
      <IdentityChip profile={props.profile} onClick={props.onEditProfile} className="welcome-identity" />
      <div className="welcome-orbit orbit-one">⭐</div>
      <div className="welcome-orbit orbit-two">🍀</div>
      <section className="welcome-card home-card">
        <div className="brand-mark" aria-hidden="true"><span>⚡</span><span>🍉</span><span>🦊</span></div>
        <p className="eyebrow">רואים מהר · לוחצים ראשונים</p>
        <h1>Dobble <em>Live</em></h1>
        <p className="welcome-copy">נכנסים בשנייה. את השם והסמל תמיד אפשר לשנות.</p>

        <div className="home-actions" aria-label="אפשרויות משחק">
          <button className="home-action quick-action" onClick={props.onQuickPlay} disabled={!props.connected || props.busy}>
            <span className="action-icon">⚡</span>
            <span><strong>משחק מהיר</strong><small>נמצא לכם שחקנים ונתחיל</small></span>
            <b aria-hidden="true">←</b>
          </button>
          <button className="home-action" onClick={props.onCreate} disabled={!props.connected || props.busy}>
            <span className="action-icon mint">＋</span>
            <span><strong>חדר לחברים</strong><small>QR, קישור וקוד להזמנה</small></span>
            <b aria-hidden="true">←</b>
          </button>
          <form className="join-action" onSubmit={(event) => { event.preventDefault(); props.onJoin(); }}>
            <label htmlFor="room-code">יש לי קוד</label>
            <div>
              <input
                id="room-code"
                className="code-input"
                dir="ltr"
                inputMode="text"
                value={props.joinCode}
                onChange={(event) => props.onJoinCodeChange(sanitizeCode(event.target.value))}
                maxLength={4}
                autoComplete="off"
                placeholder="XK4T"
                aria-describedby="code-help"
              />
              <button aria-label="הצטרפות עם הקוד" disabled={!props.connected || props.busy || props.joinCode.length !== 4}>כניסה</button>
            </div>
            <small id="code-help">4 תווים · בלי O, 0, I או 1</small>
          </form>
        </div>

        {props.recentGroup && (
          <button className="recent-group" onClick={props.onRecent} disabled={!props.connected || props.busy}>
            <span className="recent-avatars">
              {props.recentGroup.players.slice(0, 3).map((player, index) => <i key={`${player.name}-${index}`}>{avatarSymbol(player.avatarId).glyph}</i>)}
            </span>
            <span><small>הקבוצה האחרונה</small><strong>שוב עם {recentNames}</strong></span>
            <b aria-hidden="true">←</b>
          </button>
        )}
        {props.message && <p className="form-error" role="alert">{props.message}</p>}
        <p className="microcopy"><span className={props.connected ? "status-dot online" : "status-dot"} /> {props.busy ? "מסדרים את המשחק…" : props.connected ? "מוכנים למשחק בזמן אמת" : "מתחברים לשרת…"}</p>
      </section>
    </main>
  );
}

function IdentityChip({ profile, onClick, className = "" }: { profile: Profile; onClick: () => void; className?: string }) {
  const symbol = avatarSymbol(profile.avatarId);
  return (
    <button className={`identity-chip ${className}`} onClick={onClick} aria-label={`עריכת זהות: ${profile.name}, ${symbol.label}`}>
      <span>{symbol.glyph}</span><strong>{profile.name}</strong><small>עריכה</small>
    </button>
  );
}

function ProfileEditor({ profile, onSave, onClose }: { profile: Profile; onSave: (profile: Profile) => void; onClose: () => void }) {
  const [name, setName] = useState(profile.name);
  const [avatarId, setAvatarId] = useState(profile.avatarId);
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <button className="dialog-close" onClick={onClose} aria-label="סגירה">×</button>
        <p className="eyebrow">הזהות שלכם</p>
        <h2 id="profile-title">איך תיראו במשחק?</h2>
        <label className="profile-name"><span>שם</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} autoComplete="nickname" autoFocus /></label>
        <fieldset className="avatar-picker">
          <legend>סמל</legend>
          <div>{AVATAR_CHOICES.map((id) => <button type="button" key={id} className={avatarId === id ? "selected" : ""} onClick={() => setAvatarId(id)} aria-label={SYMBOLS[id].label} aria-pressed={avatarId === id}>{SYMBOLS[id].glyph}</button>)}</div>
        </fieldset>
        <button className="primary-button" disabled={!name.trim()} onClick={() => onSave({ ...profile, name: name.trim(), avatarId })}>שמירה</button>
        <p>השם והסמל נשמרים רק במכשיר הזה.</p>
      </section>
    </div>
  );
}

function TopBar(props: { room: RoomSnapshot; profile: Profile; connected: boolean; copied: boolean; onCopy: () => void; onEditProfile: () => void; onLeave: () => void }) {
  return (
    <header className="topbar">
      <div className="mini-brand"><span className="mini-logo">⚡</span><strong>Dobble Live</strong></div>
      <button className="room-code-chip" onClick={props.onCopy} aria-label="העתקת קוד החדר"><small>חדר</small><b dir="ltr">{props.room.code}</b><span>{props.copied ? "הועתק" : "העתקה"}</span></button>
      <IdentityChip profile={props.profile} onClick={props.onEditProfile} />
      <button className="text-button" onClick={props.onLeave}>יציאה</button>
      <span className={`connection-light ${props.connected ? "online" : ""}`} title={props.connected ? "מחובר" : "מנותק"} />
    </header>
  );
}

function Lobby(props: {
  room: RoomSnapshot;
  playerId: string;
  busy: boolean;
  copiedCode: boolean;
  copiedLink: boolean;
  inviteUrl: string;
  serverNow: number;
  onCopy: () => void;
  onInvite: () => void;
  onDeckSizeChange: (deckSize: DeckSize) => void;
  onStart: () => void;
}) {
  const connectedCount = props.room.players.filter((player) => player.connected).length;
  const canStart = connectedCount >= 2;
  const countdown = props.room.autoStartAt ? Math.max(1, Math.ceil((props.room.autoStartAt - props.serverNow) / 1000)) : null;
  return (
    <section className="lobby-page page-panel">
      <div className="lobby-intro">
        <p className="eyebrow">{props.room.visibility === "public" ? "משחק מהיר" : "החדר מוכן"}</p>
        <h1>{countdown ? `מתחילים בעוד ${countdown}` : connectedCount > 1 ? "כולם כאן. אפשר להתחיל" : "מזמינים חברים ומתחילים"}</h1>
        <p>{props.room.visibility === "public" && connectedCount < 2 ? "מחפשים לכם שחקנים. אפשר גם להזמין חברים בינתיים." : "שלוש דרכים פשוטות להכניס את כולם לחדר."}</p>
      </div>

      <div className="invite-grid">
        <div className="invite-card qr-card"><span>סריקה מהירה</span><QrCode value={props.inviteUrl} /><small>סורקים ונכנסים ישר לחדר</small></div>
        <button className="invite-card share-card" onClick={props.onInvite}>
          <span className="share-glyph">↗</span><strong>{props.copiedLink ? "הקישור הועתק ✓" : "הזמנת חברים"}</strong><small>WhatsApp, הודעה או כל אפליקציה</small>
        </button>
        <button className="invite-card code-card" onClick={props.onCopy}>
          <span>קוד החדר</span><strong dir="ltr">{props.room.code}</strong><small>{props.copiedCode ? "הקוד הועתק ✓" : "לחצו להעתקה"}</small>
        </button>
      </div>

      <div className="player-list-wrap">
        <div className="section-heading"><h2>שחקנים</h2><span>{props.room.players.length}/4</span></div>
        <div className="player-list">
          {props.room.players.map((player) => (
            <div className={`player-row ${!player.connected ? "offline" : ""}`} key={player.id}>
              <div className="avatar">{avatarSymbol(player.avatarId).glyph}</div>
              <strong>{player.name}{player.id === props.playerId && <small> אתם</small>}</strong>
              <span className={`ready-state ${player.connected ? "" : "offline"}`}>{player.connected ? "מוכן" : "שומרים מקום…"}</span>
            </div>
          ))}
          {Array.from({ length: Math.max(0, 4 - props.room.players.length) }, (_, index) => <div className="player-row empty" key={index}><div className="avatar">+</div><span>מקום פנוי</span></div>)}
        </div>
      </div>
      <DeckSizePicker room={props.room} onChange={props.onDeckSizeChange} />
      <button className="primary-button lobby-start" disabled={!canStart || props.busy} onClick={props.onStart}>
        {countdown ? `מתחילים עכשיו · ${countdown}` : canStart ? "מתחילים לשחק" : props.room.visibility === "public" ? "מחפשים עוד שחקן…" : "מחכים לעוד שחקן"}
      </button>
      <p className="hostless-note">כל אחד יכול להתחיל · החדר לא תלוי במארח</p>
    </section>
  );
}

function QrCode({ value }: { value: string }) {
  const [source, setSource] = useState("");
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: 260,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#17213aff", light: "#ffffffff" },
    }).then((url) => { if (active) setSource(url); }).catch(() => setSource(""));
    return () => { active = false; };
  }, [value]);
  return source ? <img src={source} alt="קוד QR להצטרפות לחדר" /> : <div className="qr-placeholder" aria-label="מכינים קוד QR" />;
}

function WaitingForNextRound({ room, inviteUrl, onInvite }: { room: RoomSnapshot; inviteUrl: string; onInvite: () => void }) {
  return (
    <section className="waiting-round page-panel">
      <div className="waiting-symbol">{avatarSymbol(room.players.at(-1)?.avatarId ?? 2).glyph}</div>
      <p className="eyebrow">נכנסתם למשחק</p>
      <h1>מצטרפים בסיבוב הבא</h1>
      <p>הסיבובים קצרים. צופים לרגע ומקבלים קלף אוטומטית כשהסיבוב הנוכחי מסתיים.</p>
      <button className="primary-button" onClick={onInvite}>להזמין עוד חברים</button>
      <small>{inviteUrl}</small>
    </section>
  );
}

function GameBoard(props: { room: RoomSnapshot; playerId: string; round: RoundPreparePayload; result: RoundResultPayload | null; serverNow: number; lockUntil: number; wrongSymbol: number | null; connected: boolean; onPick: (symbolId: number) => void }) {
  const { room, playerId, round, result, serverNow, lockUntil, wrongSymbol, connected, onPick } = props;
  const waitingMs = Math.max(0, round.startsAt - serverNow);
  const timeLeft = Math.max(0, round.endsAt - serverNow);
  const lockedMs = Math.max(0, lockUntil - serverNow);
  const active = waitingMs <= 0 && !result && connected;
  const progress = Math.min(100, (timeLeft / room.roundTimeoutMs) * 100);
  return (
    <section className="game-page">
      <ScoreStrip room={room} playerId={playerId} />
      <div className="round-meta"><span>סיבוב {round.number}</span><b>{Math.ceil(timeLeft / 1000)} שנ׳</b><span>{round.deckRemaining} קלפים נשארו</span></div>
      <div className="timer-track"><span style={{ width: `${progress}%` }} /></div>
      <div className={`cards-stage ${waitingMs > 0 ? "is-waiting" : ""}`}>
        <div className="card-block center-block"><p><span>קלף מרכזי</span> מוצאים את הסמל המשותף</p><SymbolCard card={round.centerCard} variant="center" highlighted={result?.correctSymbolId ?? null} /></div>
        <div className="versus-pill">גם פה!</div>
        <div className="card-block personal-block"><p><span>הקלף שלכם</span> לחצו על הסמל הזהה</p><SymbolCard card={round.personalCard} variant="personal" highlighted={result?.correctSymbolId ?? null} wrongSymbol={wrongSymbol} disabled={!active || lockedMs > 0} onPick={onPick} /></div>
        {waitingMs > 0 && <div className="ready-overlay"><small>מוכנים?</small><strong>{Math.max(1, Math.ceil(waitingMs / 1000))}</strong></div>}
        {lockedMs > 0 && !result && <div className="lock-badge" role="status"><b>אופס, לא זה</b><span>אפשר לנסות שוב בעוד {(lockedMs / 1000).toFixed(1)} שנ׳</span></div>}
      </div>
      {result && <RoundOverlay result={result} />}
    </section>
  );
}

function ScoreStrip({ room, playerId }: { room: RoomSnapshot; playerId: string }) {
  return <div className="score-strip">{room.players.map((player) => <div className={`score-chip ${player.id === playerId ? "me" : ""}`} key={player.id}><span className="avatar">{avatarSymbol(player.avatarId).glyph}</span><div><small>{player.name}{player.id === playerId ? " · אתם" : ""}</small><strong>{player.score}</strong></div></div>)}</div>;
}

const CARD_POSITIONS = [
  [50, 15], [77, 28], [82, 59], [66, 82], [34, 83], [16, 61], [20, 29], [50, 51],
] as const;

function SymbolCard({ card, variant, highlighted, wrongSymbol, disabled = false, onPick }: { card: CardPayload; variant: "center" | "personal"; highlighted: number | null; wrongSymbol?: number | null; disabled?: boolean; onPick?: (symbolId: number) => void }) {
  return (
    <div className={`symbol-card ${variant}`} aria-label={variant === "center" ? "קלף מרכזי" : "הקלף שלכם"}>
      <div className="card-ring" aria-hidden="true" />
      {card.symbols.map((symbolId, index) => {
        const symbol = SYMBOLS[symbolId];
        const [left, top] = CARD_POSITIONS[index];
        const { scale, rotation } = getSymbolVariation(card.id, symbolId, index);
        const style = { "--left": `${left}%`, "--top": `${top}%`, "--scale": scale, "--rotate": `${rotation}deg` } as CSSProperties;
        const className = `symbol-button ${highlighted === symbolId ? "highlighted" : ""} ${wrongSymbol === symbolId ? "wrong" : ""}`;
        return variant === "personal"
          ? <button key={symbolId} className={className} style={style} disabled={disabled} onClick={() => onPick?.(symbolId)} aria-label={symbol.label}>{symbol.glyph}</button>
          : <span key={symbolId} className={className} style={style} role="img" aria-label={symbol.label}>{symbol.glyph}</span>;
      })}
    </div>
  );
}

function RoundOverlay({ result }: { result: RoundResultPayload }) {
  const symbol = SYMBOLS[result.correctSymbolId];
  return (
    <div className="result-overlay" role="status" aria-live="assertive">
      <div className="result-card">
        <span className="answer-symbol">{symbol.glyph}</span>
        {result.reason === "winner" ? <><p>מצאנו מנצח!</p><h2>{result.winnerName}</h2><strong>{((result.reactionMs ?? 0) / 1000).toFixed(2)} שניות</strong></> : <><p>נגמר הזמן</p><h2>זה היה {symbol.label}</h2><strong>ממשיכים מיד</strong></>}
      </div>
    </div>
  );
}

function Results({ room, playerId, busy, onDeckSizeChange, onRestart }: { room: RoomSnapshot; playerId: string; busy: boolean; onDeckSizeChange: (deckSize: DeckSize) => void; onRestart: () => void }) {
  const ranked = useMemo(() => [...room.players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "he")), [room.players]);
  const winner = ranked[0];
  return (
    <section className="results-page page-panel">
      <div className="confetti" aria-hidden="true">✦　●　★　◆　✦</div>
      <p className="eyebrow">החפיסה הסתיימה</p>
      <h1>{winner?.id === playerId ? "ניצחתם!" : `${winner?.name ?? ""} במקום הראשון`}</h1>
      <p>משחק מעולה. הנה הדירוג הסופי:</p>
      <div className="podium-list">{ranked.map((player, index) => <div className={`podium-row place-${index + 1}`} key={player.id}><span className="place">{index + 1}</span><div className="avatar">{avatarSymbol(player.avatarId).glyph}</div><strong>{player.name}{player.id === playerId && <small> אתם</small>}</strong><b>{player.score}<small> נק׳</small></b></div>)}</div>
      <DeckSizePicker room={room} onChange={onDeckSizeChange} />
      <button className="primary-button" disabled={busy || room.players.filter((player) => player.connected).length < 2} onClick={onRestart}>משחק נוסף</button>
      <p className="hostless-note">כל שחקן בחדר יכול להתחיל את המשחק הבא.</p>
    </section>
  );
}

function DeckSizePicker({ room, onChange }: { room: RoomSnapshot; onChange: (deckSize: DeckSize) => void }) {
  const playerCount = Math.max(2, room.players.filter((player) => player.connected).length);
  return (
    <fieldset className="deck-size-picker">
      <div className="deck-size-heading"><legend>אורך המשחק</legend><small>אפשר לשנות עד שמתחילים</small></div>
      <div className="deck-size-options">
        {DECK_SIZE_OPTIONS.map((deckSize) => (
          <button type="button" className={room.deckSize === deckSize ? "active" : ""} key={deckSize} aria-pressed={room.deckSize === deckSize} onClick={() => onChange(deckSize)}>
            <strong>{DECK_SIZE_LABELS[deckSize]}</strong><span>{deckSize} קלפים</span><small>{Math.floor(deckSize / (playerCount + 1))} סיבובים</small>
          </button>
        ))}
      </div>
      <p>השינוי מופיע מיד אצל כל השחקנים.</p>
    </fieldset>
  );
}

function LoadingScreen({ connected }: { connected: boolean }) {
  return <main className="loading-page"><div className="loading-symbols"><span>⭐</span><span>🍀</span><span>⚡</span></div><strong>{connected ? "מכניסים אתכם לחדר…" : "מתחברים…"}</strong></main>;
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return <button className="toast" onClick={onClose} role="alert">{message}<span>×</span></button>;
}
