'use client';
export default function Error({reset}:{reset:()=>void}) {return <main id="main" className="wrap section"><h1>Не удалось открыть страницу</h1><p>Попробуйте позже. Если ошибка повторяется, обратитесь к команде JUICY.</p><button className="btn btn-dark" onClick={reset}>Попробовать снова</button><p><a href="/">На главную</a></p></main>;}
