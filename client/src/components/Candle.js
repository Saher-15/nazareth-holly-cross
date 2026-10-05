import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import '../styles/FaithShared.css';
import '../styles/Candle.css';
import { useTranslation } from 'react-i18next';
import PageHero from './ui/PageHero';
import Reveal from './ui/Reveal';

// `value` is what goes into the prayer text sent with the order, so it stays in English.
const CHURCHES = [
  { value: "Annunciation church", labelKey: "home.siteLatin", img: "/images/latin/latin9.jpg" },
  { value: "Greek orthodox church", labelKey: "home.siteGreek", img: "/images/greek/greek11.jpg" },
];

const CANDLE_VIDEOS = [
  "https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Fcandle_pray%2FWhatsApp%20Video%202024-11-05%20at%2002.34.14_fc5f95e7.mp4?alt=media&token=cab3d08c-237e-40b6-a64d-957d19d71731",
  "https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Fcandle_pray%2FWhatsApp%20Video%202024-11-05%20at%2002.34.15_c6586f18.mp4?alt=media&token=abc653e4-85ff-425d-b8b5-fa9d903a3d49",
  "https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Fcandle_pray%2FWhatsApp%20Video%202024-11-05%20at%2002.34.37_c546bb3f.mp4?alt=media&token=8d03dac8-640b-466c-81f0-bc35ce0a7230",
  "https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Fcandle_pray%2FWhatsApp%20Video%202024-11-05%20at%2002.34.39_83f23b38.mp4?alt=media&token=cd8ea957-6c00-499e-9374-cdd99d2cbec1",
  "https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Fcandle_pray%2FWhatsApp%20Video%202024-11-05%20at%2002.34.44_4caad8a0.mp4?alt=media&token=4052f0b5-aac5-42a2-9a43-b7e70bae5fc3",
  "https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Fcandle_pray%2FWhatsApp%20Video%202024-11-05%20at%2002.34.58_71978b55.mp4?alt=media&token=006a14aa-9398-49f4-bbf5-464c144f14f0",
];

function Candle() {
  const { t } = useTranslation();

  const [form, setForm] = useState({
    firstname: "",
    lastname: "",
    email: "",
    confirmEmail: "",
    pray: ""
  });

  const [selectedChurch, setSelectedChurch] = useState("");
  const navigate = useNavigate();
  const [emailMatchError, setEmailMatchError] = useState("");
  const [inputWarning, setInputWarning] = useState("");

  const handleChangeForm = (e) => {
    const { name, value } = e.target;
    setForm((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleChurchSelection = (e) => {
    setSelectedChurch(e.target.value);
  };

  const handleLightButton = async () => {
    if (!form.firstname || !form.lastname || !form.email || !form.confirmEmail || !form.pray || !selectedChurch) {
      setInputWarning(t("candle.inputWarning"));
      setTimeout(() => {
        setInputWarning("");
      }, 2000);
      return;
    }

    if (form.email !== form.confirmEmail) {
      setEmailMatchError(t("candle.emailMatchError"));
      setTimeout(() => {
        setEmailMatchError("");
      }, 2000);
      return;
    }

    try {
      const updatedPray = `${selectedChurch}, ${form.pray}`;
      setForm((prevForm) => ({ ...prevForm, pray: updatedPray }));

      navigate("/checkoutcandle", { state: { form: { ...form, pray: updatedPray } } });
    } catch (error) {
      console.error("Error lighting a candle:");
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="ui-page fx fx-candle">
      <PageHero
        eyebrow={t("faithUi.candleEyebrow")}
        title={t("home.candleTitle")}
        lead={t("home.candleText")}
        image="/images/candle.jpg"
      />

      <div className="ui-container fx-candle__layout">
        <Reveal as="aside" className="fx-candle__guide" aria-labelledby="fx-howto-title">
          <div className="fx-candle__visual" aria-hidden="true">
            <span className="fx-candle__halo" />
            <span className="fx-flame fx-flame--lg" />
            <span className="fx-candle__wick" />
            <span className="fx-candle__wax" />
            <span className="fx-candle__plate" />
          </div>
          <h2 id="fx-howto-title" className="ui-h2 fx-candle__howto">{t("candle.howToLightACandle")}</h2>
          <p className="fx-candle__simple">{t("candle.itsSimple")}</p>
          <ol className="fx-steps">
            {["candle.step1", "candle.step2", "candle.step3"].map((key, i) => (
              <li key={key}>
                <span className="fx-steps__n" aria-hidden="true">{i + 1}</span>
                <p>{t(key)}</p>
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal className="fx-candle__card ui-glass" delay={120}>
          <form
            className="fx-candle__form"
            onSubmit={(e) => e.preventDefault()}
            aria-labelledby="fx-candle-form-title"
          >
            <h2 id="fx-candle-form-title" className="ui-eyebrow fx-candle__formtitle">
              <span className="fx-flame fx-flame--sm" aria-hidden="true" />
              {t("candle.lightAPrayCandle")}
            </h2>

            <fieldset className="fx-churches">
              <legend className="fx-churches__legend">{t("candle.selectChurch")}</legend>
              <div className="fx-churches__grid">
                {CHURCHES.map((church) => {
                  const selected = selectedChurch === church.value;
                  return (
                    <label key={church.value} className={`fx-church ${selected ? "is-selected" : ""}`}>
                      <input
                        type="radio"
                        name="church"
                        value={church.value}
                        checked={selected}
                        onChange={handleChurchSelection}
                        required
                        className="fx-church__input"
                      />
                      <img className="fx-church__img" src={church.img} alt="" loading="lazy" />
                      <span className="fx-church__shade" aria-hidden="true" />
                      <span className="fx-church__check" aria-hidden="true" />
                      <span className="fx-church__name">{t(church.labelKey)}</span>
                      <span className="fx-church__ring" aria-hidden="true" />
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="fx-fields">
              <div className="ui-field">
                <label className="ui-label" htmlFor="firstname">{t("candle.firstName")}</label>
                <input
                  type="text"
                  name="firstname"
                  id="firstname"
                  value={form.firstname}
                  onChange={handleChangeForm}
                  required
                  autoComplete="given-name"
                  className="ui-input"
                />
              </div>

              <div className="ui-field">
                <label className="ui-label" htmlFor="lastname">{t("candle.lastName")}</label>
                <input
                  type="text"
                  name="lastname"
                  id="lastname"
                  value={form.lastname}
                  onChange={handleChangeForm}
                  required
                  autoComplete="family-name"
                  className="ui-input"
                />
              </div>

              <div className="ui-field">
                <label className="ui-label" htmlFor="email">{t("candle.yourEmail")}</label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  value={form.email}
                  onChange={handleChangeForm}
                  required
                  autoComplete="email"
                  className="ui-input"
                />
              </div>

              <div className="ui-field">
                <label className="ui-label" htmlFor="confirmEmail">{t("candle.confirmEmail")}</label>
                <input
                  type="email"
                  name="confirmEmail"
                  id="confirmEmail"
                  value={form.confirmEmail}
                  onChange={handleChangeForm}
                  required
                  autoComplete="email"
                  className="ui-input"
                />
              </div>
            </div>
            {emailMatchError && (
              <p className="fx-alert fx-alert--danger" role="alert">
                <i className="fas fa-exclamation-circle" aria-hidden="true" />
                {emailMatchError}
              </p>
            )}

            <div className="ui-field">
              <label className="ui-label" htmlFor="pray">{t("candle.yourPrayer")}</label>
              <textarea
                name="pray"
                id="pray"
                rows={5}
                value={form.pray}
                onChange={handleChangeForm}
                required
                className="ui-textarea"
              ></textarea>
            </div>
            {inputWarning && (
              <p className="fx-alert fx-alert--danger" role="alert">
                <i className="fas fa-exclamation-circle" aria-hidden="true" />
                {inputWarning}
              </p>
            )}

            <div className="fx-candle__pay">
              <p className="fx-candle__price">{t("candle.toLightACandlePay")}</p>
              <button className="ui-btn ui-btn--gold fx-btn-lg" onClick={handleLightButton}>
                <span className="fx-flame fx-flame--sm fx-flame--ink" aria-hidden="true" />
                {t("candle.light")}
              </button>
            </div>
            <p className="fx-candle__secure">
              <i className="fas fa-lock" aria-hidden="true" />
              {t("faithUi.secureNext")}
            </p>
          </form>
        </Reveal>
      </div>

      <Reveal as="section" className="ui-section fx-reel" aria-labelledby="fx-reel-title">
        <div className="ui-container">
          <header className="fx-head">
            <p className="ui-eyebrow">{t("faithUi.candleVideosEyebrow")}</p>
            <h2 id="fx-reel-title" className="ui-h2">{t("faithUi.candleVideosTitle")}</h2>
          </header>
          <div
            className="fx-reel__track"
            role="region"
            tabIndex={0}
            aria-label={t("faithUi.candleVideosLabel")}
          >
            <ul className="fx-reel__list">
              {CANDLE_VIDEOS.map((url, index) => (
                <li key={url} className="fx-reel__item">
                  <video
                    src={url}
                    controls
                    playsInline
                    preload="none"
                    poster="/images/lightAcandle.jpg"
                    aria-label={`${t("faithUi.candleVideosLabel")} ${index + 1}`}
                  >
                    Your browser does not support the video tag.
                  </video>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>
    </main>
  );
}

export default Candle;
