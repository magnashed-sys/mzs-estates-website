import type {Locale} from '../../i18n/public-routing';
export type ShareLabels={heading:string;copy:string;copied:string;more:string;manual:string};
// Only the current language is sent to the share component.
const copy:Record<Locale,readonly [string,string,string,string,string]>={
 en:['Share this article','Copy link','Link copied','More options','Select and copy the link below.'],
 nl:['Deel dit artikel','Link kopiëren','Link gekopieerd','Meer opties','Selecteer en kopieer de onderstaande link.'],
 es:['Compartir este artículo','Copiar enlace','Enlace copiado','Más opciones','Selecciona y copia el enlace de abajo.'],
 de:['Artikel teilen','Link kopieren','Link kopiert','Weitere Optionen','Wählen und kopieren Sie den Link unten.'],
 fr:['Partager cet article','Copier le lien','Lien copié','Autres options','Sélectionnez et copiez le lien ci-dessous.'],
 it:['Condividi questo articolo','Copia link','Link copiato','Altre opzioni','Seleziona e copia il link qui sotto.'],
 da:['Del denne artikel','Kopiér link','Link kopieret','Flere muligheder','Markér og kopiér linket nedenfor.'],
 nb:['Del denne artikkelen','Kopier lenke','Lenke kopiert','Flere alternativer','Velg og kopier lenken nedenfor.'],
 sv:['Dela artikeln','Kopiera länk','Länk kopierad','Fler alternativ','Markera och kopiera länken nedan.'],
 fi:['Jaa artikkeli','Kopioi linkki','Linkki kopioitu','Lisää vaihtoehtoja','Valitse ja kopioi alla oleva linkki.'],
 cs:['Sdílet článek','Kopírovat odkaz','Odkaz zkopírován','Další možnosti','Vyberte a zkopírujte odkaz níže.'],
 sk:['Zdieľať článok','Kopírovať odkaz','Odkaz skopírovaný','Ďalšie možnosti','Vyberte a skopírujte odkaz nižšie.'],
 pl:['Udostępnij artykuł','Kopiuj link','Link skopiowany','Więcej opcji','Zaznacz i skopiuj poniższy link.'],
 hu:['Cikk megosztása','Hivatkozás másolása','Hivatkozás másolva','További lehetőségek','Jelölje ki és másolja az alábbi hivatkozást.'],
 lt:['Bendrinti straipsnį','Kopijuoti nuorodą','Nuoroda nukopijuota','Daugiau parinkčių','Pažymėkite ir nukopijuokite toliau esančią nuorodą.'],
 uk:['Поділитися статтею','Копіювати посилання','Посилання скопійовано','Інші варіанти','Виділіть і скопіюйте посилання нижче.'],
 ro:['Distribuie articolul','Copiază linkul','Link copiat','Mai multe opțiuni','Selectează și copiază linkul de mai jos.'],
 bg:['Споделяне на статията','Копиране на връзката','Връзката е копирана','Още опции','Изберете и копирайте връзката по-долу.'],
 el:['Κοινοποίηση άρθρου','Αντιγραφή συνδέσμου','Ο σύνδεσμος αντιγράφηκε','Περισσότερες επιλογές','Επιλέξτε και αντιγράψτε τον παρακάτω σύνδεσμο.'],
 ru:['Поделиться статьёй','Копировать ссылку','Ссылка скопирована','Другие варианты','Выделите и скопируйте ссылку ниже.'],
 tr:['Makaleyi paylaş','Bağlantıyı kopyala','Bağlantı kopyalandı','Diğer seçenekler','Aşağıdaki bağlantıyı seçip kopyalayın.'],
 'zh-CN':['分享文章','复制链接','链接已复制','更多选项','请选择并复制下方链接。'],
 ar:['مشاركة المقال','نسخ الرابط','تم نسخ الرابط','خيارات أخرى','حدد الرابط أدناه وانسخه.'],
 'pt-BR':['Compartilhar artigo','Copiar link','Link copiado','Mais opções','Selecione e copie o link abaixo.'],
};
export function shareLabels(locale:string):ShareLabels{
 const [heading,link,copied,more,manual]=copy[locale as Locale]||copy.en;
 return {heading,copy:link,copied,more,manual};
}
