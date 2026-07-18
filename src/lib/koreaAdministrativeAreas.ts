import sidoRaw from '../data/maps/sido.json?raw'
import sigunguRaw from '../data/maps/sigungu.json?raw'

type AdminProperties = {
  CODE: string
  ENG_NM: string
  KOR_NM: string
}

type TopologyGeometry = {
  properties: AdminProperties
}

type SimpleTopology = {
  objects: Record<
    string,
    {
      geometries: TopologyGeometry[]
    }
  >
}

export type MapSelection = {
  region: string
  district: string
}

const shortProvinceNames: Record<
  string,
  string
> = {
  충청북: '충북',
  충청남: '충남',
  전라북: '전북',
  전라남: '전남',
  경상북: '경북',
  경상남: '경남',
}

export function normalizeSidoName(
  name: string,
) {
  const withoutSuffix = name.replace(
    /특별자치시|특별자치도|특별시|광역시|도$/u,
    '',
  )

  return (
    shortProvinceNames[withoutSuffix] ??
    withoutSuffix
  )
}

const sidoTopology = JSON.parse(
  sidoRaw,
) as SimpleTopology

const sigunguTopology = JSON.parse(
  sigunguRaw,
) as SimpleTopology

const sidoGeometries =
  sidoTopology.objects.sido.geometries

const sigunguGeometries =
  sigunguTopology.objects.sigungu.geometries

const provinceByCodePrefix: Record<
  string,
  string
> = {}

for (const geometry of sidoGeometries) {
  const prefix =
    geometry.properties.CODE.slice(0, 2)

  provinceByCodePrefix[prefix] =
    normalizeSidoName(
      geometry.properties.KOR_NM,
    )
}

export const regions = sidoGeometries.map(
  (geometry) =>
    normalizeSidoName(
      geometry.properties.KOR_NM,
    ),
)

export const districtsByRegion: Record<
  string,
  string[]
> = {}

for (const region of regions) {
  districtsByRegion[region] = []
}

for (const geometry of sigunguGeometries) {
  const prefix =
    geometry.properties.CODE.slice(0, 2)

  const region =
    provinceByCodePrefix[prefix]

  if (!region) {
    continue
  }

  districtsByRegion[region].push(
    geometry.properties.KOR_NM,
  )
}