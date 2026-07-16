import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kode Etik Jurnalistik",
  description: "Kode etik jurnalistik yang dianut oleh Lensaplus dalam menjalankan kegiatan pers.",
};

const articles = [
  { num: 1, text: "Wartawan Indonesia bersikap independen, menghasilkan berita yang akurat, berimbang, dan tidak beritikad buruk." },
  { num: 2, text: "Wartawan Indonesia menempuh cara-cara yang profesional dalam melaksanakan tugas jurnalistik." },
  { num: 3, text: "Wartawan Indonesia selalu menguji informasi, memberitakan secara berimbang, tidak mencampurkan fakta dan opini yang menghakimi, serta menerapkan asas praduga tak bersalah." },
  { num: 4, text: "Wartawan Indonesia tidak membuat berita bohong, fitnah, sadis, dan cabul." },
  { num: 5, text: "Wartawan Indonesia tidak menyebutkan dan menyiarkan identitas korban kejahatan susila dan tidak menyebutkan identitas anak yang menjadi pelaku kejahatan." },
  { num: 6, text: "Wartawan Indonesia tidak menyalahgunakan profesi dan tidak menerima suap." },
  { num: 7, text: "Wartawan Indonesia memiliki hak tolak untuk melindungi narasumber yang tidak bersedia diketahui identitas maupun keberadaannya, menghargai ketentuan embargo, informasi latar belakang, dan off the record sesuai dengan kesepakatan." },
  { num: 8, text: "Wartawan Indonesia tidak menulis atau menyiarkan berita berdasarkan prasangka atau diskriminasi terhadap seseorang atas dasar perbedaan suku, ras, warna kulit, agama, jenis kelamin, dan bahasa serta tidak merendahkan martabat orang lemah, miskin, sakit, cacat jiwa atau cacat jasmani." },
  { num: 9, text: "Wartawan Indonesia menghormati hak narasumber tentang kehidupan pribadinya, kecuali untuk kepentingan publik." },
  { num: 10, text: "Wartawan Indonesia segera mencabut, meralat, dan memperbaiki berita yang keliru dan tidak akurat disertai dengan permintaan maaf kepada pembaca, pendengar, dan atau pemirsa." },
  { num: 11, text: "Wartawan Indonesia melayani hak jawab dan hak koreksi secara proporsional." },
];

export default function KodeEtikPage() {
  return (
    <div className="bg-surface min-h-screen">
      <div className="container-main py-12">
        <div className="mx-auto max-w-3xl">
          <h1 className="flex items-center gap-3 text-xl font-bold text-txt-primary sm:text-2xl lg:text-3xl">
            <span className="block h-8 w-[3px] rounded-full bg-secondary" />
            Kode Etik Jurnalistik
          </h1>

          <div className="mt-8 space-y-6 font-serif text-[17px] leading-relaxed text-txt-secondary">
            <p>
              Lensaplus menganut dan mematuhi <strong className="text-txt-primary">Kode Etik Jurnalistik</strong> yang
              ditetapkan oleh Dewan Pers Indonesia, serta <strong className="text-txt-primary">Pedoman Pemberitaan Media Siber</strong>.
            </p>

            <div className="space-y-5">
              {articles.map((item) => (
                <div key={item.num} className="flex gap-4">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                    {item.num}
                  </span>
                  <div>
                    <h2 className="font-bold text-txt-primary">Pasal {item.num}</h2>
                    <p className="mt-1">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 rounded-lg border border-primary/20 bg-primary-light p-4">
              <p className="text-sm text-primary-dark">
                <strong>Sumber:</strong> Kode Etik Jurnalistik yang ditetapkan Dewan Pers melalui
                Peraturan Dewan Pers Nomor: 6/Peraturan-DP/V/2008 tentang Pengesahan Surat Keputusan
                Dewan Pers Nomor 03/SK-DP/III/2006 tentang Kode Etik Jurnalistik sebagai Peraturan Dewan Pers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
