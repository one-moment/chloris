import { useState } from "react";

export default function AuthScreen({ onLogin, onRegister, error, isSubmitting }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    handle: "",
    password: "",
    inviteCode: ""
  });

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    if (mode === "register") {
      onRegister(form);
      return;
    }
    onLogin({ email: form.email, password: form.password });
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-heading">
          <span>1moment workspace</span>
          <h1>팀 커뮤니케이션 MVP</h1>
          <p>직원 계정으로 로그인해 채널, 메시지, 게시판을 사용하세요.</p>
        </div>

        <div className="auth-tabs">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>로그인</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>계정 생성</button>
        </div>

        {mode === "register" && (
          <>
            <label>
              이름
              <input value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="홍길동" autoComplete="name" />
            </label>
            <label>
              멘션 핸들
              <input value={form.handle} onChange={(event) => updateField("handle", event.target.value)} placeholder="@captain" autoComplete="username" />
            </label>
            <label>
              초대 코드
              <input value={form.inviteCode} onChange={(event) => updateField("inviteCode", event.target.value)} placeholder="관리자에게 받은 초대 코드" autoComplete="one-time-code" />
            </label>
          </>
        )}

        <label>
          이메일
          <input value={form.email} onChange={(event) => updateField("email", event.target.value)} placeholder="name@1moment.co.kr" autoComplete="email" />
        </label>
        <label>
          비밀번호
          <input value={form.password} onChange={(event) => updateField("password", event.target.value)} type="password" placeholder="6자 이상" autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button className="primary-button auth-submit" type="submit" disabled={isSubmitting}>
          {mode === "login" ? "로그인" : "계정 생성"}
        </button>
      </form>
    </main>
  );
}
