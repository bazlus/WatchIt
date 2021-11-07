namespace WatchIt.Data.Models
{

    public class Comment
    {
        public int Id { get; set; }
        public string Content { get; set; }
        public int Likes { get; set; }
        public ApplicationUser User { get; set; }
    }
}

