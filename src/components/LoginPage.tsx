import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type LoginPageProps = {
  onLoginSuccess: () => void
}

const allowedLoginId =
  import.meta.env.VITE_LOGIN_ID?.trim()

const loginEmail =
  import.meta.env.VITE_LOGIN_EMAIL?.trim()

function LoginPage({
  onLoginSuccess,
}: LoginPageProps) {
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')

  const [errorMessage, setErrorMessage] =
    useState('')

  const [isLoading, setIsLoading] =
    useState(false)

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    const enteredLoginId =
      loginId.trim().toLowerCase()

    if (!enteredLoginId) {
      setErrorMessage(
        '아이디를 입력해주세요.',
      )
      return
    }

    if (!password) {
      setErrorMessage(
        '비밀번호를 입력해주세요.',
      )
      return
    }

    if (!allowedLoginId || !loginEmail) {
      setErrorMessage(
        '로그인 설정을 불러오지 못했어요.',
      )
      return
    }

    if (
      enteredLoginId !==
      allowedLoginId.toLowerCase()
    ) {
      setErrorMessage(
        '아이디나 비밀번호를 다시 확인해주세요.',
      )
      return
    }

    setErrorMessage('')
    setIsLoading(true)

    const { error } =
      await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      })

    setIsLoading(false)

    if (error) {
      console.error(
        '로그인 실패:',
        error.message,
      )

      setErrorMessage(
        '아이디나 비밀번호를 다시 확인해주세요.',
      )
      return
    }

    onLoginSuccess()
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-character">
          <img
            src={`${import.meta.env.BASE_URL}images/duck-squirrel-crayon.png`}
            alt="노란 오리와 분홍 리본 다람쥐"
          />
        </div>

        <form
          className="login-form"
          onSubmit={handleSubmit}
        >
          <label className="login-field">
            <span>아이디</span>

            <input
              type="text"
              value={loginId}
              placeholder="아이디"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(event) => {
                setLoginId(event.target.value)
                setErrorMessage('')
              }}
            />
          </label>

          <label className="login-field">
            <span>비밀번호</span>

            <input
              type="password"
              value={password}
              placeholder="비밀번호"
              autoComplete="current-password"
              onChange={(event) => {
                setPassword(event.target.value)
                setErrorMessage('')
              }}
            />
          </label>

          {errorMessage && (
            <p
              className="login-error"
              role="alert"
            >
              ⚠️ {errorMessage}
            </p>
          )}

          <button
            className="login-button"
            type="submit"
            disabled={isLoading}
          >
            {isLoading
              ? '로그인 중...'
              : '여행지도 열기'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default LoginPage