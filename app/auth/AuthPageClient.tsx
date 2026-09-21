"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import AlertMessage from "@/components/AlertMessage";

type AuthMode =
  | "login"
  | "signup";

type MemberStatus = {
  approval_status:
    | "Pending"
    | "Active"
    | "Rejected";
};

export default function AuthPageClient() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const inviteToken =
    searchParams
      .get("invite")
      ?.trim() ?? "";

  const requestedMode =
    searchParams.get(
      "mode"
    );

  const [mode, setMode] =
    useState<AuthMode>(
      requestedMode ===
        "signup"
        ? "signup"
        : "login"
    );

  const [email, setEmail] =
    useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    messageType,
    setMessageType,
  ] = useState<
    | "success"
    | "error"
    | "warning"
    | "info"
  >("info");

  useEffect(() => {
    if (
      requestedMode ===
      "signup"
    ) {
      setMode("signup");
    }

    if (
      requestedMode ===
      "login"
    ) {
      setMode("login");
    }
  }, [requestedMode]);

  /*
   * =======================================================
   * CLAIM INVITE
   * =======================================================
   */

  async function claimInvite() {
    if (!inviteToken) {
      return true;
    }

    const {
      data: sessionData,
      error: sessionError,
    } =
      await supabase.auth.getSession();

    if (
      sessionError ||
      !sessionData.session
    ) {
      setMessageType(
        "error"
      );

      setMessage(
        "Signed in, but your session could not be verified."
      );

      return false;
    }

    try {
      const response =
        await fetch(
          "/api/clubs/invite",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${sessionData.session.access_token}`,
            },

            body:
              JSON.stringify(
                {
                  token:
                    inviteToken,
                }
              ),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok
      ) {
        setMessageType(
          "error"
        );

        setMessage(
          result.error ||
            "Unable to join this club."
        );

        return false;
      }

      return true;
    } catch (error) {
      console.error(
        "Unable to claim invite:",
        error
      );

      setMessageType(
        "error"
      );

      setMessage(
        "Unable to join this club. Please try again."
      );

      return false;
    }
  }

  /*
   * =======================================================
   * ROUTE SIGNED-IN USER
   * =======================================================
   */

  async function routeSignedInUser(
    userId: string
  ) {
    const inviteClaimed =
      await claimInvite();

    if (!inviteClaimed) {
      return;
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select(
        "member_id, club_id"
      )
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      setMessageType(
        "error"
      );

      setMessage(
        `Signed in, but unable to load your profile: ${profileError.message}`
      );

      return;
    }

    if (!profile?.club_id) {
      router.push(
        "/create-club"
      );

      router.refresh();

      return;
    }

    if (!profile.member_id) {
      router.push(
        "/complete-profile"
      );

      router.refresh();

      return;
    }

    const {
      data: member,
      error: memberError,
    } = await supabase
      .from("members")
      .select(
        "approval_status"
      )
      .eq(
        "id",
        profile.member_id
      )
      .maybeSingle<MemberStatus>();

    if (memberError) {
      setMessageType(
        "error"
      );

      setMessage(
        `Signed in, but unable to load your member status: ${memberError.message}`
      );

      return;
    }

    if (!member) {
      router.push(
        "/complete-profile"
      );

      router.refresh();

      return;
    }

    if (
      member.approval_status ===
      "Pending"
    ) {
      router.push(
        "/pending-approval"
      );

      router.refresh();

      return;
    }

    if (
      member.approval_status ===
      "Rejected"
    ) {
      router.push(
        "/pending-approval"
      );

      router.refresh();

      return;
    }

    router.push("/");

    router.refresh();
  }

  /*
   * =======================================================
   * SIGN IN / SIGN UP
   * =======================================================
   */

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");

    setMessageType(
      "info"
    );

    const normalizedEmail =
      email
        .trim()
        .toLowerCase();

    if (!normalizedEmail) {
      setMessageType(
        "error"
      );

      setMessage(
        "Email is required."
      );

      return;
    }

    if (
      password.length < 6
    ) {
      setMessageType(
        "error"
      );

      setMessage(
        "Password must contain at least 6 characters."
      );

      return;
    }

    setSubmitting(true);

    /*
     * SIGN UP
     */

    if (
      mode === "signup"
    ) {
      const confirmationUrl =
        inviteToken
          ? `${window.location.origin}/auth?invite=${encodeURIComponent(
              inviteToken
            )}&mode=login`
          : `${window.location.origin}/auth`;

      const {
        data,
        error,
      } =
        await supabase.auth.signUp(
          {
            email:
              normalizedEmail,

            password,

            options: {
              emailRedirectTo:
                confirmationUrl,
            },
          }
        );

      if (error) {
        setMessageType(
          "error"
        );

        setMessage(
          `Unable to create account: ${error.message}`
        );

        setSubmitting(
          false
        );

        return;
      }

      if (
        data.session &&
        data.user
      ) {
        await routeSignedInUser(
          data.user.id
        );
      } else {
        setMessageType(
          "success"
        );

        setMessage(
          inviteToken
            ? "Account created. Please check your email and confirm your account, then sign in to finish joining the club."
            : "Account created. Please check your email and confirm your account before signing in."
        );
      }

      setSubmitting(
        false
      );

      return;
    }

    /*
     * SIGN IN
     */

    const {
      data,
      error,
    } =
      await supabase.auth
        .signInWithPassword(
          {
            email:
              normalizedEmail,

            password,
          }
        );

    if (error) {
      setMessageType(
        "error"
      );

      setMessage(
        `Unable to sign in: ${error.message}`
      );

      setSubmitting(false);

      return;
    }

    if (!data.user) {
      setMessageType(
        "error"
      );

      setMessage(
        "Signed in, but the user account could not be loaded."
      );

      setSubmitting(false);

      return;
    }

    await routeSignedInUser(
      data.user.id
    );

    setSubmitting(false);
  }

  /*
   * =======================================================
   * FORGOT PASSWORD
   * =======================================================
   */

  async function handleForgotPassword() {
    setMessage("");

    setMessageType(
      "info"
    );

    const normalizedEmail =
      email
        .trim()
        .toLowerCase();

    if (!normalizedEmail) {
      setMessageType(
        "warning"
      );

      setMessage(
        "Enter your email address first, then click Forgot password."
      );

      return;
    }

    setSubmitting(true);

    const { error } =
      await supabase.auth
        .resetPasswordForEmail(
          normalizedEmail,
          {
            redirectTo:
              `${window.location.origin}/auth/reset-password`,
          }
        );

    if (error) {
      setMessageType(
        "error"
      );

      setMessage(
        `Unable to send password reset email: ${error.message}`
      );

      setSubmitting(false);

      return;
    }

    setMessageType(
      "success"
    );

    setMessage(
      "Password reset email sent. Please check your inbox."
    );

    setSubmitting(false);
  }

  function changeMode(
    nextMode: AuthMode
  ) {
    setMode(nextMode);

    setMessage("");

    setMessageType(
      "info"
    );

    setPassword("");
  }

  return (
    <main className="starz-auth">

      {/* ========================================
          FULL CINEMATIC BACKGROUND
          ======================================== */}

      <div
        className="cinematic-background"
        aria-hidden="true"
      />

      <div
        className="background-overlay"
        aria-hidden="true"
      />

      {/* ========================================
          ANIMATED CRICKET BALL
          ======================================== */}

      <div
        className="ball-orbit"
        aria-hidden="true"
      >
        <div className="light-trail" />

        <div className="moving-ball">
          <span />
        </div>
      </div>

      {/* ========================================
          REAL LOGIN / SIGNUP
          ======================================== */}

      <section className="auth-content">

        <div className="form-card">

          <div className="text-center">


            <h1 className="club-title">
              Starz Club
            </h1>

            <p className="club-subtitle">
              {inviteToken
                ? mode === "login"
                  ? "Sign in to accept your club invitation."
                  : "Create an account to accept your club invitation."
                : mode === "login"
                  ? "Sign in to your club account."
                  : "Create your club account."}
            </p>

          </div>

          {/* INVITATION */}

          {inviteToken && (
            <div className="invite-banner">
              🏏 You&apos;re continuing
              from a club invitation.
            </div>
          )}

          {/* ========================================
              LOGIN / SIGNUP TABS
              ======================================== */}

          <div className="auth-tabs">

            <button
              type="button"
              onClick={() =>
                changeMode(
                  "login"
                )
              }
              className={
                mode === "login"
                  ? "auth-tab active"
                  : "auth-tab"
              }
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={() =>
                changeMode(
                  "signup"
                )
              }
              className={
                mode === "signup"
                  ? "auth-tab active"
                  : "auth-tab"
              }
            >
              Sign Up
            </button>

          </div>

          {/* ========================================
              FORM
              ======================================== */}

          <form
            onSubmit={
              handleSubmit
            }
            className="auth-form"
          >

            <label className="field">

              <span>
                Email *
              </span>

              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(
                  event
                ) =>
                  setEmail(
                    event.target
                      .value
                  )
                }
                placeholder="Enter your email"
              />

            </label>

            <label className="field">

              <span>
                Password *
              </span>

              <input
                type="password"
                required
                minLength={6}
                autoComplete={
                  mode ===
                  "login"
                    ? "current-password"
                    : "new-password"
                }
                value={
                  password
                }
                onChange={(
                  event
                ) =>
                  setPassword(
                    event.target
                      .value
                  )
                }
                placeholder="Enter your password"
              />

              <div className="password-help">

                <p>
                  Minimum 6
                  characters.
                </p>

                {mode ===
                  "login" && (
                  <button
                    type="button"
                    disabled={
                      submitting
                    }
                    onClick={() =>
                      void handleForgotPassword()
                    }
                  >
                    Forgot
                    password?
                  </button>
                )}

              </div>

            </label>

            {/* SIGN-UP PRIVACY */}

            {mode ===
              "signup" && (
              <div className="privacy-box">

                <input
                  id="privacy"
                  type="checkbox"
                  required
                />

                <label htmlFor="privacy">

                  I acknowledge
                  that my
                  information will
                  be used for club
                  membership and
                  administration as
                  described in the{" "}

                  <Link
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Privacy Policy
                  </Link>

                  .

                </label>

              </div>
            )}

            {/* SUBMIT */}

            <button
              type="submit"
              disabled={
                submitting
              }
              className="submit-button"
            >

              {submitting
                ? mode ===
                  "login"
                  ? "Signing in…"
                  : "Creating account…"
                : mode ===
                    "login"
                  ? "Sign In"
                  : "Create Account"}

            </button>

          </form>

          {message && (
            <div className="alert-wrapper">

              <AlertMessage
                type={
                  messageType
                }
                message={
                  message
                }
              />

            </div>
          )}

        </div>

      </section>

      {/* ========================================
          CSS
          ======================================== */}

      <style jsx>{`

        .starz-auth {
          position: relative;
          width: 100vw;
          min-height: 100vh;
          min-height: 100dvh;
          margin-left: calc(50% - 50vw);
          overflow: hidden;

          display: flex;
          align-items: center;
          justify-content: flex-end;

          background: #06152d;
        }

        /* =====================================
           BACKGROUND IMAGE

           IMPORTANT:
           This is the NEW image with
           NO FAKE LOGIN FORM inside it.
           ===================================== */

        .cinematic-background {
          position: absolute;
          inset: 0;
          z-index: 0;

          background-image:
            url("/starz-womens-cricket-hero.png");

          /*
           * CONTAIN is intentional.
           *
           * It shows the complete artwork:
           * woman's head
           * bat
           * body
           * artwork text
           * footer artwork
           *
           * instead of zooming/cropping it.
           */

          width: 100%;
          height: 100%;

          background-size:
            cover !important;

          background-position:
            center center;

          background-repeat:
            no-repeat;

          background-color:
            #06152d;

          animation:
            cinematicDrift
            14s
            ease-in-out
            infinite
            alternate;
        }

        /*
         * Very subtle darkening on the
         * right so the REAL form remains
         * easy to read.
         */

        .background-overlay {
          position: absolute;
          inset: 0;
          z-index: 1;

          pointer-events: none;

          background:
            linear-gradient(
              90deg,
              rgba(
                3,
                13,
                35,
                0
              )
              0%,

              rgba(
                3,
                13,
                35,
                0
              )
              45%,

              rgba(
                3,
                13,
                35,
                .15
              )
              64%,

              rgba(
                3,
                13,
                35,
                .42
              )
              100%
            );
        }

        /* =====================================
           REAL FORM POSITION
           ===================================== */

        .auth-content {
          position: relative;
          z-index: 10;

          width: 40%;
          min-height: 100vh;

          display: flex;
          align-items: center;
          justify-content: center;

          padding:
            45px
            clamp(
              30px,
              5vw,
              90px
            );
        }

        /* =====================================
           GLASS LOGIN CARD
           ===================================== */

        .form-card {
          width: 100%;
          max-width: 400px;

          padding:
            clamp(
              22px,
              2.2vw,
              32px
            );

          border-radius:
            24px;

          border:
            1px solid
            rgba(
              255,
              255,
              255,
              .75
            );

          background:
            rgba(
              255,
              255,
              255,
              .94
            );

          box-shadow:
            0
            25px
            70px
            rgba(
              0,
              0,
              0,
              .32
            ),

         

          backdrop-filter:
            blur(15px);

          -webkit-backdrop-filter:
            blur(15px);
        }

        /* =====================================
           HEADER
           ===================================== */

        .text-center {
          text-align: center;
        }

        .club-icon {
          width: 52px;
          height: 52px;

          margin:
            0 auto;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius:
            16px;

          font-size: 25px;

          color: white;

          background:
            linear-gradient(
              135deg,
              #1d4ed8,
              #7c3aed
            );

          box-shadow:
            0
            12px
            30px
            rgba(
              30,
              64,
              175,
              .22
            );
        }

        .club-title {
          margin-top:
            16px;

          font-size:
            clamp(
              30px,
              3vw,
              40px
            );

          line-height: 1;

          font-weight:
            900;

          letter-spacing:
            -.035em;

          color:
            #172554;
        }

        .club-subtitle {
          margin-top:
            10px;

          color:
            #64748b;

          font-size:
            15px;
        }

        /* =====================================
           INVITE
           ===================================== */

        .invite-banner {
          margin-top:
            20px;

          padding:
            13px 15px;

          border:
            1px solid
            #bfdbfe;

          border-radius:
            12px;

          background:
            #eff6ff;

          color:
            #1e3a8a;

          font-size:
            14px;
        }

        /* =====================================
           TABS
           ===================================== */

        .auth-tabs {
          display: grid;

          grid-template-columns:
            repeat(
              2,
              minmax(
                0,
                1fr
              )
            );

          margin-top:
            26px;

          padding:
            6px;

          border-radius:
            14px;

          background:
            #f1f5f9;
        }

        .auth-tab {
          border: 0;

          border-radius:
            10px;

          padding:
            11px 16px;

          cursor: pointer;

          background:
            transparent;

          color:
            #64748b;

          font-size:
            14px;

          font-weight:
            700;

          transition:
            all
            .2s
            ease;
        }

        .auth-tab:hover {
          color:
            #172554;
        }

        .auth-tab.active {
          color:
            #1e3a8a;

          background:
            white;

          box-shadow:
            0
            2px
            8px
            rgba(
              15,
              23,
              42,
              .1
            );
        }

        /* =====================================
           FORM
           ===================================== */

        .auth-form {
          display: grid;

          gap:
            20px;

          margin-top:
            27px;
        }

        .field {
          display: block;
        }

        .field > span {
          display: block;

          color:
            #334155;

          font-size:
            14px;

          font-weight:
            700;
        }

        .field input {
          width: 100%;

          box-sizing:
            border-box;

          margin-top:
            8px;

          padding:
            14px 15px;

          border:
            1px solid
            #cbd5e1;

          border-radius:
            12px;

          outline: none;

          background:
            rgba(
              255,
              255,
              255,
              .95
            );

          color:
            #0f172a;

          font-size:
            15px;

          box-shadow:
            0
            1px
            2px
            rgba(
              15,
              23,
              42,
              .04
            );

          transition:
            border-color
            .2s,
            box-shadow
            .2s;
        }

        .field input::placeholder {
          color:
            #94a3b8;
        }

        .field input:focus {
          border-color:
            #2563eb;

          box-shadow:
            0
            0
            0
            4px
            rgba(
              37,
              99,
              235,
              .1
            );
        }

        .password-help {
          display: flex;

          align-items:
            center;

          justify-content:
            space-between;

          gap:
            12px;

          margin-top:
            8px;
        }

        .password-help p {
          margin: 0;

          color:
            #64748b;

          font-size:
            12px;
        }

        .password-help button {
          border: 0;

          padding: 0;

          cursor: pointer;

          background:
            transparent;

          color:
            #1d4ed8;

          font-size:
            13px;

          font-weight:
            700;
        }

        .password-help button:hover {
          text-decoration:
            underline;
        }

        .password-help button:disabled {
          cursor:
            not-allowed;

          opacity:
            .55;
        }

        /* =====================================
           PRIVACY
           ===================================== */

        .privacy-box {
          display: flex;

          align-items:
            flex-start;

          gap:
            11px;

          padding:
            14px;

          border:
            1px solid
            #e2e8f0;

          border-radius:
            12px;

          background:
            #f8fafc;
        }

        .privacy-box input {
          width: 16px;
          height: 16px;

          margin-top:
            3px;

          flex-shrink: 0;

          accent-color:
            #1e3a8a;
        }

        .privacy-box label {
          color:
            #475569;

          font-size:
            13px;

          line-height:
            1.55;
        }

        .privacy-box a {
          color:
            #1d4ed8;

          font-weight:
            700;

          text-decoration:
            none;
        }

        .privacy-box a:hover {
          text-decoration:
            underline;
        }

        /* =====================================
           BUTTON
           ===================================== */

        .submit-button {
          margin-top:
            2px;

          border: 0;

          border-radius:
            12px;

          padding:
            14px 20px;

          cursor: pointer;

          background:
            linear-gradient(
              90deg,
              #1d4ed8,
              #2563eb,
              #7c3aed
            );

          color:
            white;

          font-size:
            15px;

          font-weight:
            800;

          box-shadow:
            0
            12px
            28px
            rgba(
              30,
              64,
              175,
              .22
            );

          transition:
            transform
            .2s,
            box-shadow
            .2s;
        }

        .submit-button:hover:not(:disabled) {
          transform:
            translateY(
              -2px
            );

          box-shadow:
            0
            16px
            34px
            rgba(
              30,
              64,
              175,
              .3
            );
        }

        .submit-button:disabled {
          cursor:
            not-allowed;

          opacity:
            .6;
        }

        .alert-wrapper {
          margin-top:
            18px;
        }
/* =====================================
   BALL POSITION + FLIGHT
   New Washington background
   ===================================== */

.ball-orbit {
  position: absolute;
  z-index: 6;

  /*
   * Start directly at the bat.
   * Tuned for the new zoomed-out image.
   */
  left: 37.5%;
  top: 35%;

  width: 15px;
  height: 15px;

  pointer-events: none;

  will-change: transform, opacity;
  backface-visibility: hidden;
  transform: translateZ(0);

  animation:
    ballArc
    4s
    linear
    infinite;
}


/* =====================================
   SMOOTH HIT → FLIGHT
   ===================================== */

@keyframes ballArc {

  /* invisible/reset */
  0%,
  16% {
    transform:
      translate3d(0, 0, 0)
      scale(.65);

    opacity: 0;
  }

  /* appears right at bat */
  18% {
    transform:
      translate3d(0, 0, 0)
      scale(.8);

    opacity: 1;
  }

  /* moment of contact */
  21% {
    transform:
      translate3d(3px, -2px, 0)
      scale(.95);

    opacity: 1;
  }

  /* HIT */
  24% {
    transform:
      translate3d(16px, -10px, 0)
      scale(1);

    opacity: 1;
  }

  30% {
    transform:
      translate3d(55px, -31px, 0)
      scale(.97);

    opacity: 1;
  }

  38% {
    transform:
      translate3d(115px, -61px, 0)
      scale(.92);

    opacity: 1;
  }

  46% {
    transform:
      translate3d(185px, -91px, 0)
      scale(.86);

    opacity: 1;
  }

  54% {
    transform:
      translate3d(265px, -119px, 0)
      scale(.79);

    opacity: 1;
  }

  62% {
    transform:
      translate3d(350px, -145px, 0)
      scale(.71);

    opacity: 1;
  }

  70% {
    transform:
      translate3d(440px, -168px, 0)
      scale(.63);

    opacity: .95;
  }

  78% {
    transform:
      translate3d(530px, -188px, 0)
      scale(.54);

    opacity: .82;
  }

  86% {
    transform:
      translate3d(615px, -204px, 0)
      scale(.45);

    opacity: .60;
  }

  93% {
    transform:
      translate3d(685px, -215px, 0)
      scale(.36);

    opacity: .30;
  }

  100% {
    transform:
      translate3d(745px, -222px, 0)
      scale(.28);

    opacity: 0;
  }
}
/* =====================================
   ACTUAL BALL
   ===================================== */

.moving-ball {
  position: absolute;
  inset: 0;

  border-radius: 50%;

  background:
    radial-gradient(
      circle at 35% 30%,
      #fb7185,
      #be123c 52%,
      #650a22
    );

  box-shadow:
    0 0 10px rgba(244, 114, 182, .9),
    0 0 22px rgba(217, 70, 239, .65);

  /*
   * Fast rotation makes the seam visibly
   * spin while the ball is travelling.
   */
   animation:
    ballSpin
    .22s
    linear
    infinite;

  will-change: transform;
}


/* =====================================
   CRICKET BALL SEAM
   ===================================== */

.moving-ball span {
  position: absolute;

  left: 11px;
  top: 3px;

  width: 2px;
  height: 19px;

  border-left:
    1px dashed
    rgba(255, 255, 255, .95);

  transform:
    rotate(27deg);
}


/* =====================================
   MOTION / NEON TRAIL
   ===================================== */

.light-trail {
  position: absolute;

  right: 12px;
  top: 10px;

  width: 80px;
  height: 3px;

  border-radius: 999px;

  background:
    linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, .20),
      rgba(244, 114, 182, .65)
    );

  filter: blur(2px);

  opacity: .65;

  transform: rotate(-18deg);
}


/* =====================================
   BACKGROUND SUBTLE MOVEMENT
   ===================================== */

@keyframes cinematicDrift {

  from {
    transform:
      scale(1)
      translate3d(0, 0, 0);
  }

  to {
    transform:
      scale(1.012)
      translate3d(-3px, -2px, 0);
  }
}


/* =====================================
   BALL SPIN
   ===================================== */

@keyframes ballSpin {

  from {
    transform:
      rotate(0deg);
  }

  to {
    transform:
      rotate(360deg);
  }
}


/* =====================================
   BALL FLIGHT

   0–18%:
   invisible while animation resets

   20–27%:
   ball appears at bat

   30%:
   tiny impact movement

   35–80%:
   ball launches upward/right

   100%:
   ball disappears into distance
   ===================================== */

@keyframes ballArc {

  /* Waiting/reset period */
  0%,
  14% {
    transform:
      translate3d(0, 0, 0)
      scale(.65);

    opacity: 0;
  }

  /* Ball appears at the bat */
  17% {
    transform:
      translate3d(0, 0, 0)
      scale(.78);

    opacity: 1;
  }

  /* Tiny contact/compression */
  20% {
    transform:
      translate3d(4px, -2px, 0)
      scale(.9);

    opacity: 1;
  }

  /* HIT */
  23% {
    transform:
      translate3d(18px, -10px, 0)
      scale(1);

    opacity: 1;
  }

  /*
   * Lots of smaller steps along the same curve.
   * This is what makes the flight look fluid.
   */

  30% {
    transform:
      translate3d(58px, -31px, 0)
      scale(.97);

    opacity: 1;
  }

  38% {
    transform:
      translate3d(110px, -57px, 0)
      scale(.92);

    opacity: 1;
  }

  46% {
    transform:
      translate3d(170px, -82px, 0)
      scale(.87);

    opacity: 1;
  }

  54% {
    transform:
      translate3d(235px, -107px, 0)
      scale(.80);

    opacity: 1;
  }

  62% {
    transform:
      translate3d(305px, -131px, 0)
      scale(.72);

    opacity: 1;
  }

  70% {
    transform:
      translate3d(380px, -153px, 0)
      scale(.64);

    opacity: .98;
  }

  78% {
    transform:
      translate3d(455px, -173px, 0)
      scale(.55);

    opacity: .9;
  }

  86% {
    transform:
      translate3d(525px, -190px, 0)
      scale(.46);

    opacity: .72;
  }

  93% {
    transform:
      translate3d(585px, -202px, 0)
      scale(.37);

    opacity: .35;
  }

  100% {
    transform:
      translate3d(630px, -210px, 0)
      scale(.30);

    opacity: 0;
  }
}

/* =====================================
   TRAIL APPEARS ONLY AFTER BAT CONTACT
   ===================================== */

@keyframes trailPulse {

  0%,
  24% {
    opacity: 0;
    transform:
      rotate(-18deg)
      scaleX(.2);
  }

  31% {
    opacity: .95;
    transform:
      rotate(-18deg)
      scaleX(.55);
  }

  45% {
    opacity: .8;
    transform:
      rotate(-18deg)
      scaleX(1);
  }

  75% {
    opacity: .45;
    transform:
      rotate(-18deg)
      scaleX(.75);
  }

  100% {
    opacity: 0;
    transform:
      rotate(-18deg)
      scaleX(.25);
  }
}
        /* =====================================
           TABLET
           ===================================== */

        @media (
          max-width:
          1023px
        ) {

.ball-orbit {
  display: block;

  /* position ball at the bat on mobile */
  left: 47%;
  top: 17%;

  width: 19px;
  height: 19px;

  z-index: 6;

  animation:
    mobileBallArc
    3.8s
    linear
    infinite;
}

.moving-ball span {
  left: 8px;
  top: 2px;
  height: 15px;
}

.light-trail {
  width: 75px;
}

@keyframes mobileBallArc {

  /* Ball sitting at bat */
  0%,
  14% {
    transform: translate3d(0, 0, 0) scale(.75);
    opacity: 0;
  }

  /* Appears AT contact point */
  15% {
    transform: translate3d(0, 0, 0) scale(.9);
    opacity: 1;
  }

  /* Hit */
  18% {
    transform: translate3d(5px, -4px, 0) scale(1);
    opacity: 1;
  }

  28% {
    transform: translate3d(28px, -17px, 0) scale(.96);
    opacity: 1;
  }

  40% {
    transform: translate3d(62px, -34px, 0) scale(.9);
    opacity: 1;
  }

  53% {
    transform: translate3d(101px, -49px, 0) scale(.82);
    opacity: 1;
  }

  67% {
    transform: translate3d(143px, -61px, 0) scale(.7);
    opacity: .95;
  }

  80% {
    transform: translate3d(181px, -68px, 0) scale(.58);
    opacity: .75;
  }

  92% {
    transform: translate3d(211px, -71px, 0) scale(.45);
    opacity: .35;
  }

  100% {
    transform: translate3d(230px, -69px, 0) scale(.35);
    opacity: 0;
  }
}

          .starz-auth {
            min-height:
              100vh;

            overflow-y:
              auto;

            display:
              block;

            padding-bottom:
              28px;
          }

          .cinematic-background {
            position:
              absolute;

            height:
              480px;

            background-size:
              cover;

            /*
             * Focus on player on
             * narrower screens.
             */

            background-position:
              30%
              center;

            animation:
              none;
          }

          .background-overlay {
            height:
              480px;

            background:
              linear-gradient(
                180deg,
                rgba(
                  3,
                  13,
                  35,
                  .03
                )
                0%,

                rgba(
                  3,
                  13,
                  35,
                  .15
                )
                65%,

                #06152d
                100%
              );
          }

          .auth-content {
            width: 100%;

            min-height:
              auto;

            box-sizing:
              border-box;

            justify-content:
              center;

            padding:
              390px
              16px
              30px;
          }

          .form-card {
            max-width:
              560px;

            padding:
              28px
              23px;
          }

       

        }

        /* =====================================
           MOBILE
           ===================================== */

        @media (max-width: 560px) {

          .starz-auth {
            width: 100%;
            min-height: 100dvh;
            margin: 0;

            display: flex;
            flex-direction: column;

            overflow-x: hidden;
            overflow-y: auto;

            background: #06152d;
            padding-bottom: 0;
          }

          /* HERO IMAGE */
          .cinematic-background {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;

            width: 100%;
            height: 430px;

            background-size: cover !important;
            background-position: 34% center;
            background-repeat: no-repeat;

            animation: none;
          }

          .background-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;

            width: 100%;
            height: 430px;

            background:
              linear-gradient(
                180deg,
                rgba(3, 13, 35, 0) 0%,
                rgba(3, 13, 35, .03) 65%,
                rgba(3, 13, 35, .30) 100%
              );
          }

          /* LOGIN AREA */
          .auth-content {
            position: relative;

            width: 100%;
            min-height: auto;

            display: flex;
            justify-content: center;
            align-items: flex-start;

            padding:
              395px
              14px
              14px;

            box-sizing: border-box;
          }

          /* LOGIN CARD */
          .form-card {
            width: 100%;
            max-width: 520px;

            box-sizing: border-box;

            padding:
              20px
              18px
              18px;

            border-radius: 26px;
          }

          .club-title {
            margin: 0;

            font-size: 27px;
            line-height: 1.05;
            font-weight: 600;
          }

          .club-subtitle {
            margin-top: 7px;

            font-size: 13px;
            line-height: 1.3;
          }

          .invite-banner {
            margin-top: 12px;
            padding: 10px 12px;
          }

          .auth-tabs {
            margin-top: 16px;
            padding: 5px;
          }

          .auth-tab {
            padding: 9px 12px;
          }

          .auth-form {
            margin-top: 16px;
            gap: 13px;
          }

          .field > span {
            font-size: 13px;
          }

          .field input {
            margin-top: 6px;

            padding:
              11px
              13px;

            font-size: 16px;
          }

          .password-help {
            margin-top: 5px;
            align-items: center;
          }

          .password-help p {
            font-size: 11px;
          }

          .password-help button {
            font-size: 12px;
          }

          .submit-button {
            margin-top: 0;

            min-height: 46px;

            padding:
              11px
              18px;
          }

          .privacy-box {
            padding: 10px;
          }

          .alert-wrapper {
            margin-top: 12px;
          }

          /* =====================================
             MOBILE BALL
             ===================================== */

          .ball-orbit {
            display: block !important;
            position: absolute;

            left: 38%;
            top: 174px;

            width: 9px;
            height: 9px;

            z-index: 8;
            opacity: 1;
            pointer-events: none;

            will-change: transform, opacity;
            backface-visibility: hidden;
            transform: translateZ(0);

            animation:
              mobileBallArc
              3.8s
              linear
              infinite !important;
          }

          .moving-ball {
            width: 100%;
            height: 100%;

            animation:
              ballSpin
              .20s
              linear
              infinite !important;
          }

          .moving-ball span {
            left: 4px;
            top: 1px;
            width: 1px;
            height: 8px;
          }

          .light-trail {
            right: 5px;
            top: 4px;

            width: 42px;
            height: 2px;

            filter: blur(1.2px);
            opacity: .55;
          }

          @keyframes mobileBallArc {
            0%,
            15% {
              transform:
                translate3d(0, 0, 0)
                scale(.70);

              opacity: 0;
            }

            18% {
              transform:
                translate3d(0, 0, 0)
                scale(.85);

              opacity: 1;
            }

            21% {
              transform:
                translate3d(2px, -2px, 0)
                scale(1);

              opacity: 1;
            }

            25% {
              transform:
                translate3d(10px, -8px, 0)
                scale(1);

              opacity: 1;
            }

            35% {
              transform:
                translate3d(36px, -24px, 0)
                scale(.94);

              opacity: 1;
            }

            47% {
              transform:
                translate3d(73px, -43px, 0)
                scale(.86);

              opacity: 1;
            }

            60% {
              transform:
                translate3d(112px, -59px, 0)
                scale(.75);

              opacity: 1;
            }

            73% {
              transform:
                translate3d(151px, -72px, 0)
                scale(.63);

              opacity: .9;
            }

            86% {
              transform:
                translate3d(187px, -82px, 0)
                scale(.48);

              opacity: .6;
            }

            100% {
              transform:
                translate3d(218px, -88px, 0)
                scale(.32);

              opacity: 0;
            }
          }
        }

        /* =====================================
           ACCESSIBILITY
           ===================================== */

        @media (
          prefers-reduced-motion:
          reduce
        ) {

          .cinematic-background,
          .ball-orbit,
          .moving-ball {
            animation:
              none
              !important;
          }


        }

      `}</style>

    </main>
  );
}


