import type {Locale} from '../../i18n/public-routing';
// Order: introduction, all subjects, empty, back, updated, sources, related, contact, previous, next, region, filter.
const copy: Record<Locale, readonly string[]> = {
 en:['Perspectives on real estate, private capital and business.','All subjects','No articles have been published here yet.','All insights','Updated','Sources','Related insights','Start a conversation','Previous','Next','Region','Filter'],
 nl:['Inzichten over vastgoed, privaat kapitaal en ondernemen.','Alle onderwerpen','Hier zijn nog geen artikelen gepubliceerd.','Alle inzichten','Bijgewerkt','Bronnen','Gerelateerde artikelen','Plan een kennismaking','Vorige','Volgende','Regio','Filteren'],
 es:['Perspectivas sobre inmuebles, capital privado y empresa.','Todos los temas','Todavía no hay artículos publicados aquí.','Todos los artículos','Actualizado','Fuentes','Artículos relacionados','Iniciar una conversación','Anterior','Siguiente','Región','Filtrar'],
 de:['Einblicke in Immobilien, privates Kapital und Unternehmen.','Alle Themen','Hier wurden noch keine Artikel veröffentlicht.','Alle Einblicke','Aktualisiert','Quellen','Weitere Artikel','Gespräch vereinbaren','Zurück','Weiter','Region','Filtern'],
 fr:['Regards sur l’immobilier, les capitaux privés et l’entreprise.','Tous les sujets','Aucun article n’a encore été publié ici.','Tous les articles','Mis à jour','Sources','Articles associés','Échangeons ensemble','Précédent','Suivant','Région','Filtrer'],
 it:['Approfondimenti su immobili, capitali privati e impresa.','Tutti gli argomenti','Non sono ancora stati pubblicati articoli.','Tutti gli articoli','Aggiornato','Fonti','Articoli correlati','Parliamone','Precedente','Successivo','Regione','Filtra'],
 da:['Indblik i ejendomme, privat kapital og erhverv.','Alle emner','Der er endnu ingen offentliggjorte artikler.','Alle artikler','Opdateret','Kilder','Relaterede artikler','Lad os tale sammen','Forrige','Næste','Region','Filtrér'],
 nb:['Innsikt i eiendom, privat kapital og næringsliv.','Alle emner','Ingen artikler er publisert her ennå.','Alle artikler','Oppdatert','Kilder','Relaterte artikler','La oss ta en prat','Forrige','Neste','Region','Filtrer'],
 sv:['Insikter om fastigheter, privat kapital och företagande.','Alla ämnen','Inga artiklar har publicerats här ännu.','Alla artiklar','Uppdaterad','Källor','Relaterade artiklar','Låt oss prata','Föregående','Nästa','Region','Filtrera'],
 fi:['Näkökulmia kiinteistöihin, yksityiseen pääomaan ja liiketoimintaan.','Kaikki aiheet','Artikkeleita ei ole vielä julkaistu.','Kaikki artikkelit','Päivitetty','Lähteet','Aiheeseen liittyvät artikkelit','Aloitetaan keskustelu','Edellinen','Seuraava','Alue','Suodata'],
 cs:['Pohledy na nemovitosti, soukromý kapitál a podnikání.','Všechna témata','Zatím zde nejsou žádné publikované články.','Všechny články','Aktualizováno','Zdroje','Související články','Domluvme si rozhovor','Předchozí','Další','Region','Filtrovat'],
 sk:['Pohľady na nehnuteľnosti, súkromný kapitál a podnikanie.','Všetky témy','Zatiaľ tu nie sú žiadne publikované články.','Všetky články','Aktualizované','Zdroje','Súvisiace články','Dohodnime si rozhovor','Predchádzajúce','Ďalšie','Región','Filtrovať'],
 pl:['Perspektywy dotyczące nieruchomości, kapitału prywatnego i biznesu.','Wszystkie tematy','Nie opublikowano tu jeszcze artykułów.','Wszystkie artykuły','Aktualizacja','Źródła','Powiązane artykuły','Porozmawiajmy','Poprzednie','Następne','Region','Filtruj'],
 hu:['Betekintés az ingatlanok, a magántőke és az üzleti élet világába.','Minden téma','Itt még nincsenek közzétett cikkek.','Minden cikk','Frissítve','Források','Kapcsolódó cikkek','Beszélgessünk','Előző','Következő','Régió','Szűrés'],
 lt:['Įžvalgos apie nekilnojamąjį turtą, privatų kapitalą ir verslą.','Visos temos','Čia dar nėra paskelbtų straipsnių.','Visi straipsniai','Atnaujinta','Šaltiniai','Susiję straipsniai','Pasikalbėkime','Ankstesnis','Kitas','Regionas','Filtruoti'],
 uk:['Погляди на нерухомість, приватний капітал і бізнес.','Усі теми','Тут ще немає опублікованих статей.','Усі статті','Оновлено','Джерела','Пов’язані статті','Почнімо розмову','Попередня','Наступна','Регіон','Фільтрувати'],
 ro:['Perspective despre imobiliare, capital privat și afaceri.','Toate subiectele','Nu au fost publicate încă articole aici.','Toate articolele','Actualizat','Surse','Articole similare','Să discutăm','Anterior','Următor','Regiune','Filtrează'],
 bg:['Поглед към имотите, частния капитал и бизнеса.','Всички теми','Тук все още няма публикувани статии.','Всички статии','Актуализирано','Източници','Свързани статии','Нека поговорим','Предишна','Следваща','Регион','Филтриране'],
 el:['Απόψεις για ακίνητα, ιδιωτικά κεφάλαια και επιχειρήσεις.','Όλα τα θέματα','Δεν έχουν δημοσιευτεί ακόμη άρθρα εδώ.','Όλα τα άρθρα','Ενημερώθηκε','Πηγές','Σχετικά άρθρα','Ας μιλήσουμε','Προηγούμενο','Επόμενο','Περιοχή','Φίλτρο'],
 ru:['Взгляд на недвижимость, частный капитал и бизнес.','Все темы','Здесь пока нет опубликованных статей.','Все статьи','Обновлено','Источники','Похожие статьи','Давайте обсудим','Назад','Далее','Регион','Фильтровать'],
 tr:['Gayrimenkul, özel sermaye ve iş dünyasına dair görüşler.','Tüm konular','Burada henüz yayımlanmış makale bulunmuyor.','Tüm makaleler','Güncellendi','Kaynaklar','İlgili makaleler','Görüşelim','Önceki','Sonraki','Bölge','Filtrele'],
 'zh-CN':['关于房地产、私人资本和商业的见解。','所有主题','此处尚未发布文章。','所有文章','更新日期','来源','相关文章','开始交流','上一页','下一页','地区','筛选'],
 ar:['رؤى حول العقارات ورأس المال الخاص والأعمال.','جميع المواضيع','لم تُنشر مقالات هنا بعد.','جميع المقالات','آخر تحديث','المصادر','مقالات ذات صلة','لنبدأ حوارًا','السابق','التالي','المنطقة','تصفية'],
 'pt-BR':['Perspectivas sobre imóveis, capital privado e negócios.','Todos os assuntos','Ainda não há artigos publicados aqui.','Todos os artigos','Atualizado','Fontes','Artigos relacionados','Vamos conversar','Anterior','Próximo','Região','Filtrar'],
};
export function insightsCopy(locale:string) {
 const [intro,all,empty,back,updated,sources,related,contact,previous,next,region,filter]=copy[locale as Locale]||copy.en;
 return {intro,all,empty,back,updated,sources,related,contact,previous,next,region,filter};
}
