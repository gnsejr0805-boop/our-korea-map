import {
  useEffect,
  useRef,
  useState,
} from 'react'
import type {
  ChangeEvent,
  FormEvent,
} from 'react'
import {
  updateTravelRecord,
} from '../lib/travelRecords'
import type {
  CloudTravelRecord,
} from '../lib/travelRecords'
import {
  getTravelMediaType,
  MAX_IMAGE_BYTES,
  MAX_MEDIA_FILES,
  MAX_VIDEO_BYTES,
} from '../lib/travelMedia'
import type {
  TravelMediaType,
} from '../lib/travelMedia'
import {
  districtsByRegion,
} from '../lib/koreaAdministrativeAreas'

type SelectedMedia = {
  id: string
  file: File
  previewUrl: string
  mediaType: TravelMediaType
}

type EditMemoryFormProps = {
  record: CloudTravelRecord
  onSaved: (
    record: CloudTravelRecord,
  ) => void
  onCancel: () => void
}

const regions = [
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
  '세종',
  '경기',
  '강원',
  '충북',
  '충남',
  '전북',
  '전남',
  '경북',
  '경남',
  '제주',
]

function getErrorMessage(
  error: unknown,
  fallback: string,
) {
  return error instanceof Error
    ? error.message
    : fallback
}

export default function EditMemoryForm({
  record,
  onSaved,
  onCancel,
}: EditMemoryFormProps) {
  const [region, setRegion] =
    useState(record.region)

  const [district, setDistrict] =
    useState(record.district)

  const [place, setPlace] =
    useState(record.place)

  const [date, setDate] =
    useState(record.date)

  const [comment, setComment] =
    useState(record.comment)

  const [
    removedMediaIds,
    setRemovedMediaIds,
  ] = useState<string[]>([])

  const [
    removeLegacyPhoto,
    setRemoveLegacyPhoto,
  ] = useState(false)

  const [
    selectedMedia,
    setSelectedMedia,
  ] = useState<SelectedMedia[]>([])

  const previewUrlsRef =
    useRef<string[]>([])

  const [fileInputKey, setFileInputKey] =
    useState(0)

  const [errorMessage, setErrorMessage] =
    useState('')

  const [isSaving, setIsSaving] =
    useState(false)

  const availableDistricts =
    districtsByRegion[region] ?? []

  const removedMediaIdSet =
    new Set(removedMediaIds)

  const remainingExistingCount =
    record.media.filter(
      (media) =>
        !removedMediaIdSet.has(media.id),
    ).length +
    (record.imageUrl &&
    !removeLegacyPhoto
      ? 1
      : 0)

  const totalMediaCount =
    remainingExistingCount +
    selectedMedia.length

  useEffect(() => {
    return () => {
      for (
        const previewUrl of
        previewUrlsRef.current
      ) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [])

  const toggleExistingMedia = (
    mediaId: string,
  ) => {
    setRemovedMediaIds((currentIds) =>
      currentIds.includes(mediaId)
        ? currentIds.filter(
            (id) => id !== mediaId,
          )
        : [...currentIds, mediaId],
    )

    setErrorMessage('')
  }

  const removeSelectedMedia = (
    mediaId: string,
  ) => {
    setSelectedMedia((currentMedia) => {
      const removedMedia =
        currentMedia.find(
          (media) => media.id === mediaId,
        )

      if (removedMedia) {
        URL.revokeObjectURL(
          removedMedia.previewUrl,
        )

        previewUrlsRef.current =
          previewUrlsRef.current.filter(
            (url) =>
              url !==
              removedMedia.previewUrl,
          )
      }

      return currentMedia.filter(
        (media) => media.id !== mediaId,
      )
    })
  }

  const handleMediaChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const input = event.currentTarget

    const files = Array.from(
      input.files ?? [],
    )

    setErrorMessage('')

    if (files.length === 0) {
      return
    }

    if (
      totalMediaCount + files.length >
      MAX_MEDIA_FILES
    ) {
      setErrorMessage(
        '사진과 동영상은 합쳐서 최대 ' +
          MAX_MEDIA_FILES +
          '개까지 저장할 수 있어요.',
      )

      input.value = ''
      return
    }

    const nextMedia: SelectedMedia[] = []

    try {
      for (const file of files) {
        const mediaType =
          getTravelMediaType(file)

        if (
          mediaType === 'image' &&
          file.size > MAX_IMAGE_BYTES
        ) {
          throw new Error(
            file.name +
              ': 사진은 10MB 이하여야 해요.',
          )
        }

        if (
          mediaType === 'video' &&
          file.size > MAX_VIDEO_BYTES
        ) {
          throw new Error(
            file.name +
              ': 동영상은 50MB 이하여야 해요.',
          )
        }

        const previewUrl =
          URL.createObjectURL(file)

        previewUrlsRef.current.push(
          previewUrl,
        )

        nextMedia.push({
          id: crypto.randomUUID(),
          file,
          previewUrl,
          mediaType,
        })
      }

      setSelectedMedia((currentMedia) => [
        ...currentMedia,
        ...nextMedia,
      ])

      setFileInputKey(
        (currentKey) => currentKey + 1,
      )
    } catch (error) {
      for (const media of nextMedia) {
        URL.revokeObjectURL(
          media.previewUrl,
        )

        previewUrlsRef.current =
          previewUrlsRef.current.filter(
            (url) =>
              url !== media.previewUrl,
          )
      }

      setErrorMessage(
        getErrorMessage(
          error,
          '파일을 불러오지 못했어요.',
        ),
      )
    } finally {
      input.value = ''
    }
  }

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    if (isSaving) {
      return
    }

    const trimmedPlace = place.trim()
    const trimmedComment = comment.trim()

    if (!region) {
      setErrorMessage(
        '다녀온 지역을 선택해주세요.',
      )
      return
    }

    if (!trimmedPlace) {
      setErrorMessage(
        '장소 이름을 입력해주세요.',
      )
      return
    }

    if (!date) {
      setErrorMessage(
        '여행 날짜를 선택해주세요.',
      )
      return
    }

    setErrorMessage('')
    setIsSaving(true)

    try {
      const updatedRecord =
        await updateTravelRecord({
          id: record.id,
          region,
          district,
          place: trimmedPlace,
          date,
          comment: trimmedComment,
          mediaFiles: selectedMedia.map(
            (media) => media.file,
          ),
          removedMediaIds,
          removeLegacyPhoto,
        })

      onSaved(updatedRecord)
    } catch (error) {
      console.error(
        '여행 기록 수정 중 오류:',
        error,
      )

      setErrorMessage(
        getErrorMessage(
          error,
          '추억을 수정하지 못했어요.',
        ),
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="record-form-page edit-memory-page">
      <div className="form-heading">
        <span className="small-label">
          추억 고치기
        </span>

        <h2>기록을 다시 다듬어볼까요?</h2>

        <p>
          글을 고치거나 사진과 동영상을
          추가하고 줄일 수 있어요.
        </p>
      </div>

      <form
        className="memory-form"
        onSubmit={handleSubmit}
      >
        <label className="form-field">
          <span className="field-label">
            지역
            <strong>필수</strong>
          </span>

          <select
            value={region}
            disabled={isSaving}
            onChange={(event) => {
              setRegion(event.target.value)
              setDistrict('')
              setErrorMessage('')
            }}
          >
            <option value="">
              지역을 선택해주세요
            </option>

            {regions.map((regionName) => (
              <option
                value={regionName}
                key={regionName}
              >
                {regionName}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span className="field-label">
            시·군·구
            <em>선택</em>
          </span>

          <select
            value={district}
            disabled={isSaving || !region}
            onChange={(event) => {
              setDistrict(event.target.value)
              setErrorMessage('')
            }}
          >
            <option value="">
              {region
                ? '시·군·구를 선택해주세요'
                : '지역을 먼저 선택해주세요'}
            </option>

            {availableDistricts.map(
              (districtName) => (
                <option
                  value={districtName}
                  key={districtName}
                >
                  {districtName}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="form-field">
          <span className="field-label">
            장소 이름
            <strong>필수</strong>
          </span>

          <input
            type="text"
            value={place}
            maxLength={40}
            disabled={isSaving}
            onChange={(event) => {
              setPlace(event.target.value)
              setErrorMessage('')
            }}
          />
        </label>

        <label className="form-field">
          <span className="field-label">
            여행 날짜
            <strong>필수</strong>
          </span>

          <input
            type="date"
            value={date}
            disabled={isSaving}
            onChange={(event) => {
              setDate(event.target.value)
              setErrorMessage('')
            }}
          />
        </label>

        <div className="form-field">
          <span className="field-label">
            현재 사진·동영상
            <em>삭제 가능</em>
          </span>

          {record.imageUrl ||
          record.media.length > 0 ? (
            <div className="edit-existing-media-grid">
              {record.imageUrl && (
                <div
                  className={
                    removeLegacyPhoto
                      ? 'edit-existing-media-item removed'
                      : 'edit-existing-media-item'
                  }
                >
                  <img
                    src={record.imageUrl}
                    alt="기존 대표 사진"
                  />

                  <span className="edit-existing-media-label">
                    사진
                  </span>

                  <button
                    className="edit-media-toggle"
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      setRemoveLegacyPhoto(
                        (current) => !current,
                      )
                    }}
                  >
                    {removeLegacyPhoto
                      ? '삭제 취소'
                      : '삭제'}
                  </button>
                </div>
              )}

              {record.media.map((media) => {
                const isRemoved =
                  removedMediaIdSet.has(
                    media.id,
                  )

                return (
                  <div
                    className={
                      isRemoved
                        ? 'edit-existing-media-item removed'
                        : 'edit-existing-media-item'
                    }
                    key={media.id}
                  >
                    {media.mediaType ===
                    'image' ? (
                      <img
                        src={media.url}
                        alt="기존 여행 사진"
                      />
                    ) : (
                      <video
                        src={media.url}
                        controls={!isRemoved}
                        playsInline
                        preload="metadata"
                      />
                    )}

                    <span className="edit-existing-media-label">
                      {media.mediaType ===
                      'image'
                        ? '사진'
                        : '동영상'}
                    </span>

                    <button
                      className="edit-media-toggle"
                      type="button"
                      disabled={isSaving}
                      onClick={() => {
                        toggleExistingMedia(
                          media.id,
                        )
                      }}
                    >
                      {isRemoved
                        ? '삭제 취소'
                        : '삭제'}
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="edit-media-empty">
              현재 저장된 사진이나
              동영상이 없어요.
            </p>
          )}
        </div>

        <div className="form-field">
          <span className="field-label">
            새 사진·동영상
            <em>선택</em>
          </span>

          <label className="photo-upload media-upload">
            <input
              key={fileInputKey}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
              disabled={
                isSaving ||
                totalMediaCount >=
                  MAX_MEDIA_FILES
              }
              onChange={handleMediaChange}
            />

            <span className="photo-upload-empty">
              <strong>➕</strong>
              <span>새 파일 추가하기</span>
              <small>
                저장 후 총 최대 10개
              </small>
            </span>
          </label>

          {selectedMedia.length > 0 && (
            <div className="selected-media-grid">
              {selectedMedia.map((media) => (
                <div
                  className="selected-media-item"
                  key={media.id}
                >
                  {media.mediaType ===
                  'image' ? (
                    <img
                      src={media.previewUrl}
                      alt={media.file.name}
                    />
                  ) : (
                    <video
                      src={media.previewUrl}
                      controls
                      playsInline
                      preload="metadata"
                    />
                  )}

                  <span className="selected-media-type">
                    {media.mediaType ===
                    'image'
                      ? '새 사진'
                      : '새 동영상'}
                  </span>

                  <button
                    className="selected-media-remove"
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      removeSelectedMedia(
                        media.id,
                      )
                    }}
                    aria-label="새 파일 제거"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <small className="media-selection-count">
            저장 후 {totalMediaCount} /
            {MAX_MEDIA_FILES}개
          </small>
        </div>

        <label className="form-field">
          <span className="field-label">
            우리의 한마디
            <em>선택</em>
          </span>

          <textarea
            value={comment}
            placeholder="공란으로 저장하면 한마디가 지워져요."
            maxLength={200}
            rows={5}
            disabled={isSaving}
            onChange={(event) => {
              setComment(event.target.value)
              setErrorMessage('')
            }}
          />

          <small className="field-help">
            내용을 모두 지운 뒤 저장하면
            코멘트가 삭제돼요.
          </small>
        </label>

        {errorMessage && (
          <p className="form-error">
            {errorMessage}
          </p>
        )}

        <div className="edit-form-actions">
          <button
            className="edit-cancel-button"
            type="button"
            disabled={isSaving}
            onClick={onCancel}
          >
            취소
          </button>

          <button
            className="edit-save-button"
            type="submit"
            disabled={isSaving}
          >
            {isSaving
              ? '수정 내용 저장 중...'
              : '수정 내용 저장하기'}
          </button>
        </div>
      </form>
    </section>
  )
}
