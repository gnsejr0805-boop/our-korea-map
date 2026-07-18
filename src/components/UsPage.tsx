import type {
  CloudTravelRecord,
} from '../lib/travelRecords'

type UsPageProps = {
  records: CloudTravelRecord[]
}

function formatKoreanDate(date: string) {
  if (!date) {
    return ''
  }

  const parsedDate = new Date(
    `${date}T00:00:00`,
  )

  return new Intl.DateTimeFormat(
    'ko-KR',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    },
  ).format(parsedDate)
}

function UsPage({
  records,
}: UsPageProps) {
  const sortedRecords = [...records].sort(
    (first, second) => {
      const dateComparison =
        second.date.localeCompare(first.date)

      if (dateComparison !== 0) {
        return dateComparison
      }

      return second.createdAt.localeCompare(
        first.createdAt,
      )
    },
  )

  const latestRecord =
    sortedRecords[0] ?? null

  const firstRecord =
    sortedRecords[
      sortedRecords.length - 1
    ] ?? null

  const travelDayCount = new Set(
    records.map((record) => record.date),
  ).size

  const regionCount = new Set(
    records.map((record) => record.region),
  ).size

  const placeCount = new Set(
    records.map((record) => record.place),
  ).size

  const photoCount = records.filter(
    (record) =>
      record.photoPath || record.imageUrl,
  ).length

  return (
    <section className="us-page">
      <div className="us-hero">
        <span className="tab-sticker">
          우리 이야기
        </span>

        <img
          src={`${import.meta.env.BASE_URL}images/mascots/mascot-reading.png`}
          alt="함께 여행 앨범을 읽는 오리와 다람쥐"
        />

        <h2>오리와 다람쥐의 여행일기</h2>

        <p>
          우리가 함께 만든 추억이
          여기에 차곡차곡 쌓여요.
        </p>
      </div>

      {records.length === 0 ? (
        <div className="us-empty">
          <span>📖</span>

          <strong>
            아직 기록된 추억이 없어요
          </strong>

          <p>
            첫 여행 기록을 남기면
            우리 통계가 자동으로 만들어져요.
          </p>
        </div>
      ) : (
        <>
          <div className="us-stats-grid">
            <article className="us-stat-card">
              <span>🗓️</span>

              <strong>
                {travelDayCount}
              </strong>

              <p>함께한 여행일</p>
            </article>

            <article className="us-stat-card">
              <span>🗺️</span>

              <strong>
                {regionCount}
              </strong>

              <p>방문한 지역</p>
            </article>

            <article className="us-stat-card">
              <span>📍</span>

              <strong>
                {placeCount}
              </strong>

              <p>추억의 장소</p>
            </article>

            <article className="us-stat-card">
              <span>📷</span>

              <strong>
                {photoCount}
              </strong>

              <p>함께 찍은 사진</p>
            </article>
          </div>

          {firstRecord && (
            <article className="us-memory-card first-memory">
              <span className="us-memory-icon">
                🌱
              </span>

              <div>
                <small>우리의 첫 기록</small>

                <h3>
                  {firstRecord.place}
                </h3>

                <p>
                  {firstRecord.region}
                  {' · '}
                  {formatKoreanDate(
                    firstRecord.date,
                  )}
                </p>
              </div>
            </article>
          )}

          {latestRecord && (
            <article className="us-memory-card latest-memory">
              <span className="us-memory-icon">
                💌
              </span>

              <div>
                <small>가장 최근 추억</small>

                <h3>
                  {latestRecord.place}
                </h3>

                <p>
                  {latestRecord.region}
                  {' · '}
                  {formatKoreanDate(
                    latestRecord.date,
                  )}
                </p>

                {latestRecord.comment && (
                  <blockquote>
                    {latestRecord.comment}
                  </blockquote>
                )}
              </div>
            </article>
          )}

          <div className="us-message">
            <span>🐥</span>

            <p>
              앞으로도 누나와 함께
              새로운 장소를 하나씩 채워가요.
            </p>

            <span>🐿️</span>
          </div>
        </>
      )}
    </section>
  )
}

export default UsPage
